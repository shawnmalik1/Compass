import os
import time
from collections import deque, defaultdict
from datetime import datetime
from fastapi import FastAPI, Form, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

import numpy as np
import joblib
import ast

from sentence_transformers import SentenceTransformer
from openai import OpenAI
from dotenv import load_dotenv

from config import DATA_DIR, EMBEDDING_MODEL_NAME
from faculty import scrape_faculty

INDEX_PATH = DATA_DIR / "index.pkl"

app = FastAPI(title="Granular Knowledge Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_token(x_compass_key: Optional[str] = Header(default=None)):
    if not API_ACCESS_TOKEN:
        return
    if x_compass_key != API_ACCESS_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _rate_limit(request: Request, key: str, limit: int, window: int, message: str):
    if limit <= 0 or window <= 0:
        return
    host = request.client.host if request.client else "global"
    bucket_key = f"{key}:{host}"
    now = time.time()
    bucket = _rate_buckets[bucket_key]
    while bucket and now - bucket[0] > window:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail=message)
    bucket.append(now)


def rate_limit_faculty(request: Request):
    _rate_limit(
        request,
        "faculty",
        FACULTY_RATE_LIMIT,
        FACULTY_RATE_WINDOW,
        "Too many faculty searches. Please wait a moment.",
    )


def rate_limit_upload(request: Request):
    _rate_limit(
        request,
        "upload",
        UPLOAD_RATE_LIMIT,
        UPLOAD_RATE_WINDOW,
        "Too many uploads. Please slow down.",
    )


def rate_limit_citation(request: Request):
    _rate_limit(
        request,
        "citation",
        CITATION_RATE_LIMIT,
        CITATION_RATE_WINDOW,
        "Too many citation requests. Please wait a moment.",
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

load_dotenv()
API_ACCESS_TOKEN = os.getenv("API_ACCESS_TOKEN")
FACULTY_RATE_LIMIT = int(os.getenv("FACULTY_RATE_LIMIT", "10"))
FACULTY_RATE_WINDOW = int(os.getenv("FACULTY_RATE_WINDOW", "60"))
UPLOAD_RATE_LIMIT = int(os.getenv("UPLOAD_RATE_LIMIT", "10"))
UPLOAD_RATE_WINDOW = int(os.getenv("UPLOAD_RATE_WINDOW", "60"))
CITATION_RATE_LIMIT = int(os.getenv("CITATION_RATE_LIMIT", "20"))
CITATION_RATE_WINDOW = int(os.getenv("CITATION_RATE_WINDOW", "60"))
_rate_buckets = defaultdict(deque)
embed_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
emb_norm = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def _sample_cluster_texts(mask: np.ndarray, limit: int = 5):
    idxs = np.where(mask)[0]
    samples = []
    for i in idxs:
        art = articles[i]
        headline = _clean_headline(art.get("headline"))
        if headline:
            samples.append(headline)
        if len(samples) >= limit:
            break
    return samples


def _ai_label(default_label: str, samples: List[str], level: str):
    if not openai_client or not samples:
        return default_label
    prompt = (
        "You rename clusters inside a knowledge map built from New York Times articles.\n"
        f"Provide a concise {level} label (max 4 words, Title Case) based on these sample headlines:\n"
        + "\n".join(f"- {s}" for s in samples)
        + f"\nExisting label: {default_label}\nReturn only the improved label."
    )
    try:
        response = openai_client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
        )
        text = (response.output_text or "").strip()
        return text if text else default_label
    except Exception:
        return default_label


def _apply_ai_labels():
    if not openai_client:
        return
    for cluster in coarse_clusters:
        cid = cluster["id"]
        samples = _sample_cluster_texts(coarse_ids == cid)
        if not samples:
            continue
        new_label = _ai_label(cluster["label"], samples, "topic")
        cluster["label"] = new_label
        coarse_cluster_labels[cid] = new_label
    for cluster in fine_clusters:
        fid = cluster["id"]
        samples = _sample_cluster_texts(fine_ids == fid)
        if not samples:
            continue
        new_label = _ai_label(cluster["label"], samples, "subtopic")
        cluster["label"] = new_label
        fine_cluster_labels[fid] = new_label

_apply_ai_labels()


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

class FacultyMember(BaseModel):
    name: str
    department: Optional[str] = None
    email: Optional[str] = None
    keyword: Optional[str] = None


@app.get("/api/map", response_model=MapResponse)
def get_map(_: None = Depends(require_api_token)):
    return MapResponse(
        bounds=MapBounds(**map_bounds),
        coarse_clusters=[CoarseMapNode(**c) for c in coarse_clusters],
        fine_clusters=[FineMapNode(**f) for f in fine_clusters],
    )


@app.get("/api/fine_cluster/{fine_id}", response_model=FineClusterDetailResponse)
def get_fine_cluster(fine_id: int, _: None = Depends(require_api_token)):
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
def search_articles(q: str, k: int = 20, _: None = Depends(require_api_token)):
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
async def upload_text(
    text: str = Form(...),
    _: None = Depends(require_api_token),
    __: None = Depends(rate_limit_upload),
):
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


MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


def _format_author(name: str) -> str:
    if not name:
        return ""
    parts = name.strip().replace("By ", "").replace("by ", "").split()
    if len(parts) == 1:
        return parts[0].rstrip(",")
    last = parts[-1].rstrip(",")
    initials = [p[0].upper() + "." for p in parts[:-1] if p]
    return f"{last}, {' '.join(initials)}"


def _format_author_list(authors: List[str]) -> Optional[str]:
    formatted = [fmt for fmt in (_format_author(a) for a in authors) if fmt]
    if not formatted:
        return None
    if len(formatted) == 1:
        return formatted[0]
    if len(formatted) == 2:
        return " & ".join(formatted)
    return ", ".join(formatted[:-1]) + f", & {formatted[-1]}"


def _format_date(date_str: Optional[str]) -> str:
    if not date_str:
        return "n.d."
    try:
        clean = date_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        month = MONTH_NAMES[dt.month - 1]
        day = dt.day
        return f"{dt.year}, {month} {day}"
    except Exception:
        return date_str


def _clean_title(title: Optional[str]) -> str:
    if not title:
        return "Untitled article"
    title = title.strip()
    return title[:-1] if title.endswith(".") else title


def _fallback_citation(req: CitationRequest) -> str:
    author_text = _format_author_list(req.authors or [])
    date_text = _format_date(req.pub_date)
    title = _clean_title(req.headline)
    source = req.source or "The New York Times"
    url = req.url or ""
    if author_text:
        citation = f"{author_text} ({date_text}). {title}. {source}. {url}".strip()
    else:
        citation = f"{title}. ({date_text}). {source}. {url}".strip()
    return citation


def _generate_citation(req: CitationRequest) -> str:
    fallback = _fallback_citation(req)
    if not openai_client:
        return fallback
    prompt = (
        "Format the following metadata as an APA 7 reference for a news article.\n"
        "Use the pattern: Author, A. A., & Author, B. B. (Year, Month Day). Title of article. Source. URL\n"
        "If no author is available, start with the title. Keep capitalization per APA rules. "
        "Return only the citation line.\n"
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
def create_citation(
    req: CitationRequest,
    _: None = Depends(require_api_token),
    __: None = Depends(rate_limit_citation),
):
    citation = _generate_citation(req)
    return CitationResponse(citation=citation)


@app.get("/api/faculty", response_model=List[FacultyMember])
def get_faculty(
    q: str,
    pages: int = 1,
    _: None = Depends(require_api_token),
    __: None = Depends(rate_limit_faculty),
):
    keywords = [kw.strip() for kw in q.split(",") if kw.strip()]
    if not keywords:
        raise HTTPException(status_code=400, detail="Keyword is required.")
    max_pages = max(1, min(pages, 3))
    try:
        results = scrape_faculty(keywords, max_pages=max_pages)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to fetch faculty data.") from exc
    return [FacultyMember(**row) for row in results]
