import numpy as np
import joblib
from pathlib import Path

from sentence_transformers import SentenceTransformer
from sklearn.cluster import MiniBatchKMeans
from sklearn.manifold import TSNE
from sklearn.feature_extraction.text import TfidfVectorizer

from config import DATA_DIR, EMBEDDING_MODEL_NAME, N_CLUSTERS, TSNE_PERPLEXITY
from data_prep import load_sample


def build_index():
    print("Loading sample of NYT articles...")
    df = load_sample()
    texts = df["text"].tolist()

    print(f"Embedding {len(texts)} articles...")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)

    print("Clustering articles into topics...")
    kmeans = MiniBatchKMeans(
        n_clusters=N_CLUSTERS,
        random_state=42,
        batch_size=512,
        n_init=10,
    )
    cluster_ids = kmeans.fit_predict(embeddings)

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
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2), stop_words="english")
    X_tfidf = vectorizer.fit_transform(df["text"])
    feature_names = np.array(vectorizer.get_feature_names_out())

    cluster_labels = {}
    for cid in range(N_CLUSTERS):
        mask = cluster_ids == cid
        if not np.any(mask):
            cluster_labels[cid] = f"Cluster {cid}"
            continue
        cluster_tfidf = X_tfidf[mask].mean(axis=0).A1
        top_idx = cluster_tfidf.argsort()[::-1][:4]
        terms = [feature_names[i] for i in top_idx]
        label = " / ".join(terms)
        cluster_labels[cid] = label

    index = {
        "articles": df.to_dict(orient="records"),
        "embeddings": embeddings.astype("float32"),
        "cluster_ids": cluster_ids.astype("int32"),
        "coords_2d": coords_2d.astype("float32"),
        "cluster_labels": cluster_labels,
    }

    out_path = DATA_DIR / "index.pkl"
    joblib.dump(index, out_path)
    print(f"Saved index to {out_path}")


if __name__ == "__main__":
    build_index()
