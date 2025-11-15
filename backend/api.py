import os
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

import numpy as np
import joblib
import ast

from sentence_transformers import SentenceTransformer
from openai import OpenAI

from config import DATA_DIR, EMBEDDING_MODEL_NAME

INDEX_PATH = DATA_DIR / "index.pkl"

app = FastAPI(title="Granular Knowledge Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _clean_field(value):
    """Convert NaN / Nones to None, everything else to str."""
    if value is None:
        return None
    try:
        if isinstance(value, float) and np.isnan(value):
            return None
    except Exception:
        pass
    return str(value)


def _clean_headline(value):
    """Headline sometimes comes as a dict-like structure from NYT metadata."""
    # dict case
    if isinstance(value, dict):
        main = value.get("main") or value.get("print_headline") or ""
        return str(main) if main is not None else ""

    # string that looks like a dict with 'main'
    if isinstance(value, str) and value.strip().startswith("{") and "main" in value:
        try:
            parsed = ast.literal_eval(value)
            if isinstance(parsed, dict):
                main = parsed.get("main") or parsed.get("print_headline") or ""
                if main:
                    return str(main)
        except Exception:
            pass

    cleaned = _clean_field(value)
    return cleaned or ""


# ------- load index -------

index = joblib.load(INDEX_PATH)
articles = index["articles"]
embeddings = index["embeddings"]
coords_2d = index["coords_2d"]
coarse_ids = index["coarse_ids"]
fine_ids = index["fine_ids"]
parent_fine_ids = index["parent_fine_ids"]
coarse_clusters = index["coarse_clusters"]
fine_clusters = index["fine_clusters"]
coarse_cluster_labels = index["coarse_cluster_labels"]
fine_cluster_labels = index["fine_cluster_labels"]
map_bounds = index["map_bounds"]

embed_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
emb_norm = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


class MapBounds(BaseModel):
    x_min: float
    x_max: float
    y_min: float
    y_max: float


class CoarseMapNode(BaseModel):
    id: int
    label: str
    x: float
    y: float
    size: float
    count: int


class FineMapNode(CoarseMapNode):
    parent_id: int


class ArticleSummary(BaseModel):
    id: int
    headline: str
    abstract: Optional[str] = None
    pub_date: Optional[str] = None
    section: Optional[str] = None
    byline: Optional[str] = None
    url: Optional[str] = None
    coarse_cluster_id: Optional[int] = None
    fine_cluster_id: Optional[int] = None
    x: float
    y: float
    score: Optional[float] = None


class MapResponse(BaseModel):
    bounds: MapBounds
    coarse_clusters: List[CoarseMapNode]
    fine_clusters: List[FineMapNode]


class FineClusterDetailResponse(BaseModel):
    fine_cluster_id: int
    label: str
    parent_coarse_id: int
    parent_label: str
    articles: List[ArticleSummary]


class SearchResults(BaseModel):
    query: str
    results: List[ArticleSummary]


class UploadResult(BaseModel):
    text: str
    fine_cluster_id: int
    fine_cluster_label: str
    parent_coarse_id: int
    parent_coarse_label: str
    neighbors: List[ArticleSummary]


class CitationRequest(BaseModel):
    headline: str
    pub_date: Optional[str] = None
    url: Optional[str] = None
    section: Optional[str] = None
    authors: Optional[List[str]] = None
    source: Optional[str] = "The New York Times"


class CitationResponse(BaseModel):
    citation: str


@app.get("/api/map", response_model=MapResponse)
def get_map():
    return MapResponse(
        bounds=MapBounds(**map_bounds),
        coarse_clusters=[CoarseMapNode(**c) for c in coarse_clusters],
        fine_clusters=[FineMapNode(**f) for f in fine_clusters],
    )


@app.get("/api/fine_cluster/{fine_id}", response_model=FineClusterDetailResponse)
def get_fine_cluster(fine_id: int):
    if fine_id < 0 or fine_id >= parent_fine_ids.shape[0]:
        raise HTTPException(status_code=404, detail="Fine cluster not found")

    mask = fine_ids == fine_id
    idxs = np.where(mask)[0]
    if idxs.size == 0:
        raise HTTPException(status_code=404, detail="Fine cluster not found")

    parent_id = int(parent_fine_ids[fine_id])
    parent_label = (
        coarse_cluster_labels.get(parent_id, f"Topic {parent_id}")
        if parent_id >= 0
        else "Unassigned"
    )
    label = fine_cluster_labels.get(fine_id, f"Subtopic {fine_id}")

    articles_out = []
    for i in idxs:
        art = articles[i]
        x, y = coords_2d[i]
        articles_out.append(
            ArticleSummary(
                id=int(art["id"]),
                headline=_clean_headline(art.get("headline")),
                abstract=_clean_field(art.get("abstract")),
                pub_date=_clean_field(art.get("pub_date")),
                section=_clean_field(art.get("section")),
                byline=_clean_field(art.get("byline")),
                url=_clean_field(art.get("url")),
                coarse_cluster_id=int(coarse_ids[i]),
                fine_cluster_id=int(fine_ids[i]),
                x=float(x),
                y=float(y),
            )
        )

    return FineClusterDetailResponse(
        fine_cluster_id=int(fine_id),
        label=label,
        parent_coarse_id=parent_id,
        parent_label=parent_label,
        articles=articles_out,
    )


@app.get("/api/search", response_model=SearchResults)
def search_articles(q: str, k: int = 20):
    q_vec = embed_model.encode([q], normalize_embeddings=True)[0]
    sims = emb_norm @ q_vec
    top_idx = np.argsort(-sims)[:k]

    results = []
    for i in top_idx:
        s = float(sims[i])
        art = articles[i]
        x, y = coords_2d[i]
        results.append(
            ArticleSummary(
                id=int(art["id"]),
                headline=_clean_headline(art.get("headline")),
                abstract=_clean_field(art.get("abstract")),
                pub_date=_clean_field(art.get("pub_date")),
                section=_clean_field(art.get("section")),
                byline=_clean_field(art.get("byline")),
                url=_clean_field(art.get("url")),
                coarse_cluster_id=int(coarse_ids[i]),
                fine_cluster_id=int(fine_ids[i]),
                x=float(x),
                y=float(y),
                score=s,
            )
        )

    return SearchResults(query=q, results=results)


@app.post("/api/upload", response_model=UploadResult)
async def upload_text(text: str = Form(...)):
    q_vec = embed_model.encode([text], normalize_embeddings=True)[0]
    sims = emb_norm @ q_vec
    top_idx = np.argsort(-sims)[:10]

    neighbor_fine_clusters = fine_ids[top_idx]
    unique, counts = np.unique(neighbor_fine_clusters, return_counts=True)
    best_fine_cluster = int(unique[np.argmax(counts)])

    parent_id = int(parent_fine_ids[best_fine_cluster])
    fine_label = fine_cluster_labels.get(
        best_fine_cluster, f"Subtopic {best_fine_cluster}"
    )
    parent_label = (
        coarse_cluster_labels.get(parent_id, f"Topic {parent_id}")
        if parent_id >= 0
        else "Unassigned"
    )

    neighbors = []
    for i in top_idx:
        s = float(sims[i])
        art = articles[i]
        x, y = coords_2d[i]
        neighbors.append(
            ArticleSummary(
                id=int(art["id"]),
                headline=_clean_headline(art.get("headline")),
                abstract=_clean_field(art.get("abstract")),
                pub_date=_clean_field(art.get("pub_date")),
                section=_clean_field(art.get("section")),
                byline=_clean_field(art.get("byline")),
                url=_clean_field(art.get("url")),
                coarse_cluster_id=int(coarse_ids[i]),
                fine_cluster_id=int(fine_ids[i]),
                x=float(x),
                y=float(y),
                score=s,
            )
        )

    return UploadResult(
        text=text,
        fine_cluster_id=best_fine_cluster,
        fine_cluster_label=fine_label,
        parent_coarse_id=parent_id,
        parent_coarse_label=parent_label,
        neighbors=neighbors,
    )


def _fallback_citation(req: CitationRequest) -> str:
    authors = req.authors or []
    if not authors and req.section:
        authors = [req.section]
    author_part = "; ".join(authors) if authors else req.source or "The New York Times"
    date = req.pub_date or "n.d."
    title = req.headline or "Untitled article"
    source = req.source or "The New York Times"
    url = req.url or ""
    citation = f"{author_part} ({date}). {title}. {source}. {url}".strip()
    return citation


def _generate_citation(req: CitationRequest) -> str:
    fallback = _fallback_citation(req)
    if not openai_client:
        return fallback
    prompt = (
        "Create an APA 7 citation for the following news article metadata. "
        "If some details are missing, infer in a natural scholarly way. "
        "Return only the final citation text.\n"
        f"Headline: {req.headline}\n"
        f"Authors: {', '.join(req.authors or [])}\n"
        f"Publication date: {req.pub_date}\n"
        f"Section: {req.section}\n"
        f"Source: {req.source}\n"
        f"URL: {req.url}"
    )
    try:
        response = openai_client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
        )
        text = (response.output_text or "").strip()
        return text or fallback
    except Exception:
        return fallback


@app.post("/api/citation", response_model=CitationResponse)
def create_citation(req: CitationRequest):
    citation = _generate_citation(req)
    return CitationResponse(citation=citation)
