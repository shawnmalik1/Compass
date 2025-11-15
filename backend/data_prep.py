import kagglehub
import pandas as pd
from pathlib import Path
from config import N_ARTICLES


def load_sample(n=N_ARTICLES, random_state=42) -> pd.DataFrame:
    # Download dataset via kagglehub
    path = kagglehub.dataset_download("aryansingh0909/nyt-articles-21m-2000-present")
    path = Path(path)

    # Adjust this if the filename differs in the Kaggle dataset
    csv_path = path / "nyt-metadata.csv"
    if not csv_path.exists():
        # try fallback names
        for alt in path.glob("*.csv"):
            csv_path = alt
            break

    df = pd.read_csv(csv_path)

    # Try to be robust to column naming
    # headline-ish column
    headline_col = None
    for c in df.columns:
        lc = c.lower()
        if "headline" in lc or "title" in lc:
            headline_col = c
            break

    abstract_col = None
    for c in df.columns:
        lc = c.lower()
        if "abstract" in lc or "snippet" in lc or "lead_paragraph" in lc:
            abstract_col = c
            break

    if headline_col is None:
        raise ValueError("Could not find a headline/title column in NYT metadata.")
    if abstract_col is None:
        abstract_col = headline_col  # fallback

    # Drop rows missing both headline and abstract
    df = df.dropna(subset=[headline_col, abstract_col])

    # Sample subset for hackathon scale
    df = df.sample(n=min(n, len(df)), random_state=random_state)

    # Normalized columns
    df = df.rename(columns={
        headline_col: "headline",
        abstract_col: "abstract",
    })

    # text used for embedding
    df["text"] = df["headline"].fillna("") + ". " + df["abstract"].fillna("")
    if "pub_date" not in df.columns:
        # Try 'date' or similar
        date_col = None
        for c in df.columns:
            if "date" in c.lower():
                date_col = c
                break
        if date_col:
            df = df.rename(columns={date_col: "pub_date"})
        else:
            df["pub_date"] = None

    # Section / category
    if "section" not in df.columns:
        for c in df.columns:
            if "section" in c.lower():
                df = df.rename(columns={c: "section"})
                break
        if "section" not in df.columns:
            df["section"] = None

    # URL
    if "url" not in df.columns:
        url_col = None
        for c in df.columns:
            if "url" in c.lower():
                url_col = c
                break
        if url_col:
            df = df.rename(columns={url_col: "url"})
        else:
            df["url"] = None

    # Ensure we have an id
    if "id" not in df.columns:
        df = df.reset_index().rename(columns={"index": "id"})

    return df[["id", "headline", "abstract", "text", "pub_date", "section", "url"]]
