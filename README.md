# Research Compass

Research Compass is a hackathon-ready workflow that embeds an uploaded document, finds the closest New York Times reporting, visualizes the relationship as a force-directed graph, and asks OpenAI for tightly scoped insights plus citations.

## Repository Layout

```
research-compass/
├── backend/    # Node + Express API + Claude + embeddings
└── frontend/   # Vite + React + Tailwind + react-force-graph
```

## Backend

- Loads `nyt_embeddings.json` into memory during startup for zero-latency cosine searches.
- Routes:
  - `POST /upload` – Multer + pdf/text extraction, returns `{ text }`.
  - `POST /embed` – Calls OpenAI embeddings API.
  - `POST /nearest` – Cosine similarity search over in-memory NYT dataset.
  - `POST /analyze` – Sends structured prompt to OpenAI, enforces citation guardrail.
  - `GET /health` and `GET /articles` – simple diagnostics.
- Utilities:
- `utils/claude.js` – thin wrapper around the `openai` SDK for embeddings + chat.
  - `utils/vector.js` – cosine helpers + `findNearest`.
  - `utils/chunker.js` – PDF/text extraction (chunking optional).

### Backend setup

```bash
cd backend
npm install
cp .env.example .env        # add CLAUDE_API_KEY=...
node index.js               # or npm run dev
```

Drop your curated NYT embedding file into `backend/nyt_embeddings.json`. A tiny sample ships for local testing.

Need to trim a massive CSV export? Use the helper script to retain the 10k most recent rows and emit JSON:

```bash
node backend/scripts/filter-nyt.js backend/nyt-metadata.csv backend/nyt_embeddings.json 10000
```

The script expects the CSV to contain at least `pub_date` (or similar) plus the embedding column and will write the transformed JSON into the backend root.

## Frontend

- React + Vite + Tailwind UI with three screens (Upload, Graph, Insights).
- Global context (`CompassContext`) keeps the document text, embedding, nearest articles, and Claude analysis in sync across routes.
- API helpers (`src/api/*.js`) use Axios to talk to the backend.
- `Graph.jsx` wraps `react-force-graph` to plot the user's document against the NYT neighbors with custom colors, labels, and hover/click behaviors.
- `GraphPage` hosts the visualization + right-hand insight panel; `InsightsPage` surfaces the saved analysis in a print-friendly layout.

### Frontend setup

```bash
cd frontend
npm install
npm run dev        # default on http://localhost:5173
```

Set `VITE_API_URL` in `frontend/.env` if your backend is not on `http://localhost:3000`.

## Demo Flow

1. Start the backend (`node index.js`) and frontend (`npm run dev`).
2. Visit `http://localhost:5173/upload`, choose a PDF or text file.
3. The app extracts text, requests a Claude embedding, fetches nearest NYT articles, stores everything in context, and navigates to `/graph`.
4. The graph shows your document as the hub connected to the closest NYT articles. Click a node to inspect metadata in the side panel.
5. Click **Generate Insights** to call `POST /analyze`. Claude summarizes the doc, lists insights, cites 3–7 NYT articles, and highlights opposing/complementary views.
6. Open the Insights tab for a focused summary + citation list ready to share.

The entire experience is designed for fast iteration during a hackathon: no database, no background jobs—just memory-resident vectors, clear routes, and a tight React UI.
