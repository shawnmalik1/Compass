import numpy as np
import joblib
import os

from sentence_transformers import SentenceTransformer
from sklearn.cluster import MiniBatchKMeans
from sklearn.manifold import TSNE
from sklearn.feature_extraction.text import TfidfVectorizer
from openai import OpenAI

from config import (
    DATA_DIR,
    EMBEDDING_MODEL_NAME,
    TSNE_PERPLEXITY,
    COARSE_CLUSTER_COUNT,
    FINE_CLUSTER_COUNT,
)
from data_prep import load_sample

LABEL_BLOCKLIST = {
    "kicker",
    "content",
    "print",
    "headline",
    "seo",
    "main",
    "sub",
    "lede",
    "section",
    "page",
    "story",
}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def _clean_terms(scores, feature_names, default_label):
    sorted_idx = scores.argsort()[::-1]
    terms = []
    for idx in sorted_idx:
        term = feature_names[idx]
        clean = term.replace("_", " ").strip()
        if len(clean) < 3:
            continue
        lower = clean.lower()
        if any(bad in lower for bad in LABEL_BLOCKLIST):
            continue
        if lower.isdigit():
            continue
        terms.append(clean)
        if len(terms) == 3:
            break
    if not terms:
        return default_label
    return " / ".join(terms)


def _build_labels(assignments, tfidf_matrix, feature_names, count, prefix):
    labels = {}
    for cid in range(count):
        mask = assignments == cid
        default_label = f"{prefix} {cid}"
        if not np.any(mask):
            labels[cid] = default_label
            continue
        cluster_scores = tfidf_matrix[mask].mean(axis=0).A1
        labels[cid] = _clean_terms(cluster_scores, feature_names, default_label)
    return labels


def _sample_cluster_text(df, mask, limit=5):
    try:
        headlines = (
            df.loc[mask, "headline"]
            .dropna()
            .astype(str)
            .str.strip()
            .replace("", np.nan)
            .dropna()
            .tolist()
        )
    except Exception:
        headlines = []
    if not headlines:
        try:
            abstracts = (
                df.loc[mask, "abstract"]
                .dropna()
                .astype(str)
                .str.strip()
                .replace("", np.nan)
                .dropna()
                .tolist()
            )
        except Exception:
            abstracts = []
        headlines = abstracts
    return headlines[:limit]


def _ai_label(default_label, samples, level):
    if not openai_client or not samples:
        return default_label
    prompt = (
        f"You are naming clusters inside a knowledge graph of New York Times articles.\n"
        f"Provide a concise {level} label (max 4 words) based on the following sample headlines:\n"
        + "\n".join(f"- {s}" for s in samples)
        + "\nCurrent label suggestion: "
        f"{default_label}\nRespond with only the improved label."
    )
    try:
        response = openai_client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
        )
        text = (response.output_text or "").strip()
        if not text:
            return default_label
        return text[:80]
    except Exception:
        return default_label


def build_index():
    print("Loading sample of NYT articles...")
    df = load_sample()
    texts = df["text"].tolist()

    print(f"Embedding {len(texts)} articles...")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)

    print("Clustering articles into coarse and fine topics...")
    coarse_kmeans = MiniBatchKMeans(
        n_clusters=COARSE_CLUSTER_COUNT,
        random_state=42,
        batch_size=512,
        n_init=10,
    )
    coarse_ids = coarse_kmeans.fit_predict(embeddings)

    fine_kmeans = MiniBatchKMeans(
        n_clusters=FINE_CLUSTER_COUNT,
        random_state=123,
        batch_size=512,
        n_init=10,
    )
    fine_ids = fine_kmeans.fit_predict(embeddings)

    print("Computing 2D layout with t-SNE (for map positions)...")
    tsne = TSNE(
        n_components=2,
        perplexity=min(TSNE_PERPLEXITY, len(texts) - 1),
        random_state=42,
        init="random",
        learning_rate="auto",
    )
    coords_2d = tsne.fit_transform(embeddings)

    print("Computing cluster labels from TF-IDF...")
    vectorizer = TfidfVectorizer(
        max_features=6000, ngram_range=(1, 2), stop_words="english"
    )
    X_tfidf = vectorizer.fit_transform(df["text"])
    feature_names = np.array(vectorizer.get_feature_names_out())

    coarse_labels = _build_labels(
        coarse_ids, X_tfidf, feature_names, COARSE_CLUSTER_COUNT, "Topic"
    )
    fine_labels = _build_labels(
        fine_ids, X_tfidf, feature_names, FINE_CLUSTER_COUNT, "Subtopic"
    )

    if openai_client:
        print("Refining cluster names with OpenAI...")
        for cid in range(COARSE_CLUSTER_COUNT):
            mask = coarse_ids == cid
            if not np.any(mask):
                continue
            samples = _sample_cluster_text(df, mask)
            coarse_labels[cid] = _ai_label(
                coarse_labels.get(cid, f"Topic {cid}"), samples, "broad topic"
            )
        for fid in range(FINE_CLUSTER_COUNT):
            mask = fine_ids == fid
            if not np.any(mask):
                continue
            samples = _sample_cluster_text(df, mask)
            fine_labels[fid] = _ai_label(
                fine_labels.get(fid, f"Subtopic {fid}"), samples, "subtopic"
            )

    print("Summarizing clusters for the map...")
    coords_array = np.asarray(coords_2d)
    x_min, y_min = coords_array.min(axis=0)
    x_max, y_max = coords_array.max(axis=0)
    map_bounds = {
        "x_min": float(x_min),
        "x_max": float(x_max),
        "y_min": float(y_min),
        "y_max": float(y_max),
    }

    coarse_clusters = []
    for cid in range(COARSE_CLUSTER_COUNT):
        mask = coarse_ids == cid
        if not np.any(mask):
            continue
        coords = coords_array[mask]
        x_mean, y_mean = coords.mean(axis=0)
        count = int(mask.sum())
        size = 10 + np.log1p(count) * 6
        coarse_clusters.append(
            {
                "id": int(cid),
                "label": coarse_labels.get(cid, f"Topic {cid}"),
                "x": float(x_mean),
                "y": float(y_mean),
                "size": float(size),
                "count": count,
            }
        )

    parent_fine_ids = np.full(FINE_CLUSTER_COUNT, -1, dtype=np.int32)
    fine_clusters = []
    for fid in range(FINE_CLUSTER_COUNT):
        mask = fine_ids == fid
        if not np.any(mask):
            continue
        member_coarse = coarse_ids[mask]
        counts = np.bincount(member_coarse, minlength=COARSE_CLUSTER_COUNT)
        parent = int(counts.argmax())
        parent_fine_ids[fid] = parent
        coords = coords_array[mask]
        x_mean, y_mean = coords.mean(axis=0)
        count = int(mask.sum())
        size = 6 + np.log1p(count) * 4
        fine_clusters.append(
            {
                "id": int(fid),
                "label": fine_labels.get(fid, f"Subtopic {fid}"),
                "parent_id": parent,
                "x": float(x_mean),
                "y": float(y_mean),
                "size": float(size),
                "count": count,
            }
        )

    index = {
        "articles": df.to_dict(orient="records"),
        "embeddings": embeddings.astype("float32"),
        "coords_2d": coords_array.astype("float32"),
        "coarse_ids": coarse_ids.astype("int32"),
        "fine_ids": fine_ids.astype("int32"),
        "parent_fine_ids": parent_fine_ids.astype("int32"),
        "coarse_clusters": coarse_clusters,
        "fine_clusters": fine_clusters,
        "coarse_cluster_labels": coarse_labels,
        "fine_cluster_labels": fine_labels,
        "map_bounds": map_bounds,
    }

    out_path = DATA_DIR / "index.pkl"
    joblib.dump(index, out_path)
    print(f"Saved index to {out_path}")


if __name__ == "__main__":
    build_index()
