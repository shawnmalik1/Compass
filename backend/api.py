from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

import numpy as np
import joblib

from sentence_transformers import SentenceTransformer

from config import DATA_DIR, EMBEDDING_MODEL_NAME

INDEX_PATH = DATA_DIR / "index.pkl"

app = FastAPI(title="Granular Knowledge Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------- helpers ---------
def _clean_field(value):
    """Convert NaN / nones to None, everything else to str."""
    if value is None:
        return None
    # handle numpy / float NaNs
    try:
        if isinstance(value, float) and np.isnan(value):
            return None
    except Exception:
        pass
    return str(value)


# Load index at startup
index = joblib.load(INDEX_PATH)
articles = index["articles"]
embeddings = index["embeddings"]
cluster_ids = index["cluster_ids"]
coords_2d = index["coords_2d"]
cluster_labels = index["cluster_labels"]

embed_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
emb_norm = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)


class MapNode(BaseModel):
    id: int
    label: str
    x: float
    y: float
    size: float
    count: int
    level: int  # 0 = cluster, 1 = article


class ArticleSummary(BaseModel):
    id: int
    headline: str
    abstract: Optional[str] = None
    pub_date: Optional[str] = None
    section: Optional[str] = None
    url: Optional[str] = None
    cluster_id: int
    x: float
    y: float
    score: Optional[float] = None


class MapResponse(BaseModel):
    clusters: List[MapNode]


class ClusterDetailResponse(BaseModel):
    cluster_id: int
    label: str
    articles: List[ArticleSummary]


class SearchResults(BaseModel):
    query: str
    results: List[ArticleSummary]


class UploadResult(BaseModel):
    text: str
    cluster_id: int
    cluster_label: str
    neighbors: List[ArticleSummary]


def cosine_sim(a, b):
    return float(np.dot(a, b))


@app.get("/api/map", response_model=MapResponse)
def get_map():
    # Aggregate clusters
    unique_clusters = np.unique(cluster_ids)
    nodes = []

    for cid in unique_clusters:
        mask = cluster_ids == cid
        coords = coords_2d[mask]
        if coords.size == 0:
            continue
        x_mean, y_mean = coords.mean(axis=0)
        count = int(mask.sum())
        size = 5 + np.log1p(count) * 8

        label = cluster_labels.get(int(cid), f"Cluster {cid}")
        nodes.append(
            MapNode(
                id=int(cid),
                label=label,
                x=float(x_mean),
                y=float(y_mean),
                size=float(size),
                count=count,
                level=0,
            )
        )

    return MapResponse(clusters=nodes)


@app.get("/api/cluster/{cluster_id}", response_model=ClusterDetailResponse)
def get_cluster(cluster_id: int):
    mask = cluster_ids == cluster_id
    idxs = np.where(mask)[0]

    arts = []
    for i in idxs:
        art = articles[i]
        x, y = coords_2d[i]
        arts.append(
            ArticleSummary(
                id=int(art["id"]),
                headline=_clean_field(art["headline"]) or "",
                abstract=_clean_field(art.get("abstract")),
                pub_date=_clean_field(art.get("pub_date")),
                section=_clean_field(art.get("section")),
                url=_clean_field(art.get("url")),
                cluster_id=int(cluster_id),
                x=float(x),
                y=float(y),
            )
        )

    return ClusterDetailResponse(
        cluster_id=cluster_id,
        label=cluster_labels.get(cluster_id, f"Cluster {cluster_id}"),
        articles=arts,
    )


@app.get("/api/search", response_model=SearchResults)
def search_articles(q: str, k: int = 20):
    # Embed query
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
                headline=_clean_field(art["headline"]) or "",
                abstract=_clean_field(art.get("abstract")),
                pub_date=_clean_field(art.get("pub_date")),
                section=_clean_field(art.get("section")),
                url=_clean_field(art.get("url")),
                cluster_id=int(cluster_ids[i]),
                x=float(x),
                y=float(y),
                score=s,
            )
        )

    return SearchResults(query=q, results=results)


@app.post("/api/upload", response_model=UploadResult)
async def upload_text(text: str = Form(...)):
    # text is passed as plain text form field
    q_vec = embed_model.encode([text], normalize_embeddings=True)[0]
    sims = emb_norm @ q_vec
    top_idx = np.argsort(-sims)[:10]

    # Determine closest cluster from nearest neighbors
    neighbor_clusters = cluster_ids[top_idx]
    unique, counts = np.unique(neighbor_clusters, return_counts=True)
    best_cluster = int(unique[np.argmax(counts)])

    cluster_label = cluster_labels.get(best_cluster, f"Cluster {best_cluster}")

    neighbors = []
    for i in top_idx:
        s = float(sims[i])
        art = articles[i]
        x, y = coords_2d[i]
        neighbors.append(
            ArticleSummary(
                id=int(art["id"]),
                headline=_clean_field(art["headline"]) or "",
                abstract=_clean_field(art.get("abstract")),
                pub_date=_clean_field(art.get("pub_date")),
                section=_clean_field(art.get("section")),
                url=_clean_field(art.get("url")),
                cluster_id=int(cluster_ids[i]),
                x=float(x),
                y=float(y),
                score=s,
            )
        )

    return UploadResult(
        text=text,
        cluster_id=best_cluster,
        cluster_label=cluster_label,
        neighbors=neighbors,
    )
