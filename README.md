# Compass

Full-stack project that builds an interactive map of New York Times topics from a Kaggle dataset and lets you:
- Zoom and hover over topic bubbles
- Click into a topic to see individual articles
- Search semantically across the corpus
- Paste/upload text and see where it lands on the map

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

Then open http://localhost:5175 in your browser.
