# Research Compass - Granular Knowledge Map

Compass combines two complementary experiences:

1. **Granular topic exploration** - A FastAPI + Python pipeline embeds a Kaggle NYT dataset, clusters it into 40 coarse and 200 fine topics, and renders an interactive D3 map so you can zoom from broad beats (e.g., Health) into subtopics (e.g., Stem Cell Therapy). Search and paste-in-text features reuse the same embeddings so you can see where your ideas land inside the knowledge map.
2. **Document intelligence + insights** - A Node + Express backend handles PDF/text uploads, runs Claude embeddings, finds nearest NYT coverage, and asks Claude for tightly scoped insights and citations. The React force graph (`react-force-graph-2d`) visualizes those neighbors alongside your document for deeper analysis.

Instead of scrolling feeds, you can visually explore how ideas relate, drill down into subtopics, or drop in your own writing to see related reporting and generate citations.

## Why it matters

- **Accelerate research.** Coarse/fine topic hierarchies make it easy to jump from a broad beat to specific threads in seconds.
- **Power student projects.** Upload a paper draft or summary and instantly discover matching NYT coverage and suggested citations.
- **Zoom into concepts, not noise.** When you enter a cluster the surrounding map fades, keeping focus on that topic's inner structure.

## Core capabilities

- **Hierarchical topic map** - D3 renders exploded "subtopic orbits" for legibility when you zoom into fine clusters.
- **Semantic search** - SentenceTransformer embeddings let you query ideas instead of raw keywords.
- **Document drop-in** - Paste text or upload a PDF, place it inside the nearest fine cluster, and list the most similar NYT articles.
- **Research-first UX** - Focus mode hides unrelated bubbles, tooltips summarize subtopics, and the sidebar pivots between search, cluster deep dives, upload results, and your force graph insights.

## Repository layout

```
backend/            # Node service (upload, embed, nearest, analyze) + scripts/utilities
backend/api.py      # FastAPI entry point (map/search/upload endpoints)
frontend/           # Vite + React + Tailwind + react-force-graph + D3 map UI
```

## Backend services

You now run **two** servers side-by-side. The Vite dev server proxies `/api/*` to FastAPI on port 8000 and everything else to the Node backend on port 3000.

### 1. FastAPI knowledge map (Python)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # or .\.venv\Scripts\activate on Windows
pip install -r requirements.txt
python build_index.py            # one-time: builds embeddings, clusters, & 2D layout
uvicorn api:app --reload --port 8000
```

`build_index.py` expects the Kaggle NYT CSV + embeddings referenced in `config.py`. It creates `backend/data/index.pkl`, which FastAPI loads on startup to serve:

- `GET /api/map` - coarse/fine cluster geometry + bounds
- `GET /api/fine_cluster/:id` - fine cluster metadata + article coordinates
- `GET /api/search?q=...` - semantic search over the embedded articles
- `POST /api/upload` - accept raw text, embed it with `sentence-transformers`, return top neighbors plus the closest fine cluster

### 2. Node/Express insight service

```bash
cd backend
npm install
cp .env.example .env  # add CLAUDE_API_KEY and optional overrides
npm run dev           # or node index.js
# or run both this service and FastAPI together:
# npm run dev:all
```

Key routes:

- `POST /upload` - Multer + pdf/text extraction, returns `{ text }`
- `POST /embed` - Calls Claude embeddings (kept for future use)
- `POST /nearest` - Cosine search over `nyt_embeddings.json` (still available as a fallback)
- `POST /analyze` - Sends a structured prompt to Claude, anchored to whatever `nearestArticles` the frontend sends
- `GET /articles` - provides a sample slice for demo/fallback graphs

Utilities in `backend/scripts/` help trim or reformat the NYT CSV so the Python side stays fast.

## Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 with Vite proxies configured
```

What's new:

- `KnowledgeMap.jsx` renders the coarse topic bubbles + zoomed fine nodes via D3. Selecting a cluster controls the force graph sidebar.
- `MapSidebar.jsx` reuses the semantic search + upload UX. Typed text calls the FastAPI `/api/upload`, while file uploads still go through the Node backend for PDF extraction but immediately ask FastAPI for the better Kaggle neighbors.
- `Graph.jsx` (react-force-graph-2d) keeps your document node + animated links. It now consumes whichever article set is active: doc upload, pasted text, a selected fine cluster, or semantic search results.
- The Details/Insights panel stays the same, and `POST /analyze` still receives the final list of articles so Claude can cite them.

Tailwind (`src/styles/globals.css`) handles the overall shell, while `src/index.css` keeps the dedicated map/search styles authored for the knowledge map.

## Typical flow

1. Start both backends (FastAPI on :8000, Express on :3000).
2. Run `npm run dev` in `frontend/` and open http://localhost:5173.
3. Paste arbitrary text in the right-hand sidebar *or* upload a document. Uploads still call the Node `/upload` route for extraction, but the text immediately goes to FastAPI for the Kaggle neighbors + cluster metadata.
4. Explore the **Knowledge Map** card to drill into coarse vs fine clusters. The map and sidebar drive the force graph, so selecting a subtopic or search result instantly refreshes the React force graph view.
5. When a document is active, click **Generate Insights** to run the guarded Claude analysis that cites only the neighbors currently stored in context.

## Notes & tips

- Need to refresh the Kaggle-derived dataset? Update `config.py` and re-run `python build_index.py`. It writes a new `data/index.pkl` the API will load on restart.
- If you swap out the Node `nyt_embeddings.json`, keep the schema identical so `/articles` and `/analyze` continue to work.
- The Vite dev server proxies both APIs, so no CORS fiddling is required locally. For production replicate the `/api` vs `/upload|/analyze` routing with your reverse proxy.
- The frontend normalizes article objects (section name, url, snippet) everywhere before handing them to Claude, react-force-graph, or the knowledge-map sidebar. That means both backends can evolve independently as long as they return the expected fields.

Have fun combining the macro map with the micro react-force-graph view!
