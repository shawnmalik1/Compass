# Research Compass

Research Compass blends two complementary workflows:

- A **FastAPI + Python** pipeline that embeds the Kaggle NYT dataset, clusters it into coarse/fine topics, exposes an interactive map, semantic search, and text-to-cluster lookups powered by `sentence-transformers`.
- A **Node + Express** pipeline that handles PDF/text uploads, calls Claude for embeddings/analysis, and returns citations plus insights that reference whatever neighbors the frontend provides.

The React/Vite frontend stitches both worlds together. You can explore your friend's higher-level knowledge map, zoom into specific clusters, paste arbitrary text, or upload a document to keep the force-directed insights you already built with `react-force-graph`.

## Repository layout

```
backend/            # Node service (upload, embed, nearest, analyze) + scripts/utilities
backend/api.py      # FastAPI entry point (map/search/upload endpoints)
frontend/           # Vite + React + Tailwind + react-force-graph + D3 map UI
```

## Backend services

You now run **two** servers side-by-side. The frontend proxies to both (`/api` ' FastAPI on :8000, everything else ' Express on :3000).

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

- `GET /api/map` ' coarse/fine cluster geometry + bounds
- `GET /api/fine_cluster/:id` ' fine cluster metadata + article coordinates
- `GET /api/search?q=...` ' semantic search over the embedded articles
- `POST /api/upload` ' accept raw text, embed it with `sentence-transformers`, return top neighbors plus the closest fine cluster

### 2. Node/Express insight service

```bash
cd backend
npm install
cp .env.example .env  # add CLAUDE_API_KEY and optional overrides
npm run dev           # or node index.js
```

Key routes:

- `POST /upload` ' Multer + pdf/text extraction, returns `{ text }`
- `POST /embed` ' Calls Claude embeddings (kept for future use)
- `POST /nearest` ' Cosine search over `nyt_embeddings.json` (still available as a fallback)
- `POST /analyze` ' Sends a structured prompt to Claude, anchored to whatever `nearestArticles` the frontend sends
- `GET /articles` ' provides a sample slice for demo/fallback graphs

Utilities in `backend/scripts/` help you trim or reformat the NYT CSV so the Python side stays fast.

## Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 with Vite proxies configured
```

What's new:

- `KnowledgeMap.jsx` renders the coarse topic bubbles + zoomed fine nodes via D3. Selecting a cluster controls the force graph sidebar.
- `MapSidebar.jsx` reuses your friend's search + upload UX. Typed text calls the FastAPI `/api/upload`, while file uploads still go through the Node backend for PDF extraction but immediately ask FastAPI for the better Kaggle neighbors.
- `Graph.jsx` (react-force-graph-2d) keeps your document node + animated links. It now consumes whichever article set is active: doc upload, typed text, a selected fine cluster, or semantic search.
- The Details/Insights panel stays the same, and `POST /analyze` still receives the final list of articles so Claude can cite them.

Tailwind (`src/styles/globals.css`) handles the overall shell, while `src/index.css` keeps the dedicated map/search styles your friend authored.

## Typical flow

1. Start both backends (FastAPI on :8000, Express on :3000).
2. Run `npm run dev` in `frontend/` and open http://localhost:5173.
3. Paste arbitrary text in the right-hand sidebar *or* upload a document. Uploads still call the Node `/upload` route for extraction, but the text immediately goes to FastAPI for the Kaggle neighbors + cluster metadata.
4. Explore the **Knowledge Map** card to drill into coarse vs fine clusters. The map and sidebar drive the force graph, so selecting a subtopic or search result instantly refreshes the `react-force-graph` view.
5. When a document is active, click **Generate Insights** to run the guarded Claude analysis that cites only the neighbors currently stored in context.

## Notes & tips

- Need to refresh the Kaggle-derived dataset? Update `config.py` and re-run `python build_index.py`. It writes a new `data/index.pkl` the API will load on restart.
- If you swap out the Node `nyt_embeddings.json`, keep the schema identical so `/articles` and `/analyze` continue to work.
- The Vite dev server proxies both APIs, so no CORS fiddling is required locally. For production you'll want to replicate the `/api` vs `/upload|/analyze` routing at your reverse proxy.
- The frontend now normalizes article objects (section name, url, snippet) everywhere before handing them to Claude, react-force-graph, or the friend's components. That means both backends can evolve independently as long as they include the expected fields.

Have fun combining the macro map with the micro react-force-graph view!*** End Patch
