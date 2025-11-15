# Compass · Granular Knowledge Map

Compass turns thousands of New York Times articles into a living research atlas for students, analysts, and obsessive note-takers. Instead of scrolling through feeds, you can visually explore how ideas relate, drill down into subtopics, and even drop in your own writing to see where it belongs, and explore related articles.

## Why it matters
- **Accelerate research.** Surfacing coarse → fine topic hierarchies makes it easy to jump from “health” to “stem cell therapy” in seconds.
- **Power student projects.** Upload a paper draft or reading summary and instantly discover the closest coverage, citations, and context.
- **Zoom into concepts, not noise.** When you enter a cluster the surrounding map fades, keeping your attention on that topic’s inner structure.

## Core capabilities
- 📍 **Hierarchical topic map** – 40 coarse clusters and 200 fine clusters rendered with D3, complete with exploded “subtopic orbits” for legibility.
- 🔍 **Semantic search** – SentenceTransformer embeddings let you query ideas, not just keywords.
- ✍️ **Document drop-in** – Paste text and the backend places it inside the nearest fine cluster, listing the most similar NYT articles.
- 🧠 **Research-first UX** – Focus mode hides unrelated bubbles, tooltips summarize subtopics, and the sidebar pivots between search, cluster deep dives, and upload insights.

## Stack at a glance
- **Backend:** FastAPI, sentence-transformers, scikit-learn (MiniBatchKMeans, t-SNE), pandas/joblib for preprocessing and persistence.
- **Frontend:** React + Vite, custom D3 zoom/drag rendering, Tailwind-inspired styling in plain CSS.
- **Data:** Kaggle NYT article sample embedded and clustered offline via `build_index.py`.

## Backend

```bash
cd backend
pip install -r requirements.txt
python build_index.py   # one-time: builds embeddings, clusters and 2D layout
uvicorn api:app --reload --port 8000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Navigate to http://localhost:5175 and start exploring clusters; the sidebar updates with fine-cluster summaries, and the search/upload widgets act as your personal research copilot.
