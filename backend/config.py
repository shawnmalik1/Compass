from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# How many articles to sample from Kaggle dataset
N_ARTICLES = 8000

# Clustering / map hyperparams
N_CLUSTERS = 40
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
TSNE_PERPLEXITY = 35
