import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card.jsx';
import Graph from '../components/Graph.jsx';
import { CompassContext } from '../App.jsx';
import { analyzeDocument } from '../api/analyze.js';
import { fetchArticlesMetadata } from '../api/articles.js';

function GraphPage() {
  const navigate = useNavigate();
  const {
    documentText,
    nearestArticles,
    analysis,
    setAnalysis,
  } = useContext(CompassContext);
  const [selectedNode, setSelectedNode] = useState(null);
  const [panelError, setPanelError] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [fallbackArticles, setFallbackArticles] = useState([]);
  const [fallbackError, setFallbackError] = useState('');
  const [loadingFallback, setLoadingFallback] = useState(false);

  const documentNode = useMemo(
    () =>
      documentText
        ? {
            id: 'user-doc',
            type: 'document',
            headline: 'Your Document',
            text: documentText,
          }
        : null,
    [documentText],
  );

  useEffect(() => {
    if (documentNode) {
      setSelectedNode((prev) => prev || documentNode);
    }
  }, [documentNode]);

  const uploadedArticles = useMemo(
    () => (Array.isArray(nearestArticles) ? nearestArticles : []),
    [nearestArticles],
  );

  useEffect(() => {
    if (documentText || uploadedArticles.length || loadingFallback || fallbackArticles.length) {
      return;
    }

    let cancelled = false;
    const loadSample = async () => {
      setLoadingFallback(true);
      setFallbackError('');
      try {
        const dataset = await fetchArticlesMetadata(50);
        if (!cancelled) {
          setFallbackArticles(dataset);
        }
      } catch (err) {
        if (!cancelled) {
          setFallbackError(err.message || 'Failed to load sample graph data.');
        }
      } finally {
        if (!cancelled) {
          setLoadingFallback(false);
        }
      }
    };

    loadSample();
    return () => {
      cancelled = true;
    };
  }, [documentText, fallbackArticles.length, loadingFallback, uploadedArticles.length]);

  const displayedArticles = useMemo(
    () => (uploadedArticles.length ? uploadedArticles : fallbackArticles),
    [uploadedArticles, fallbackArticles],
  );

  useEffect(() => {
    if (documentNode || selectedNode || !displayedArticles.length) {
      return;
    }
    const [firstArticle] = displayedArticles;
    if (firstArticle) {
      setSelectedNode({ id: firstArticle.id, type: 'article' });
    }
  }, [documentNode, displayedArticles, selectedNode]);

  const highlightedArticle = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'article') {
      return null;
    }
    return displayedArticles.find((article) => article.id === selectedNode.id) || null;
  }, [displayedArticles, selectedNode]);

  const handleNodeClick = (node) => {
    setPanelError('');
    setSelectedNode(node);
  };

  const handleAnalyze = async () => {
    if (!documentText || !uploadedArticles.length) {
      setPanelError('Upload a document and load neighbors before analyzing.');
      return;
    }
    setPanelError('');
    setLoadingAnalysis(true);
    try {
      const response = await analyzeDocument(documentText, uploadedArticles);
      setAnalysis(response);
    } catch (err) {
      setPanelError(err.message || 'Failed to generate insights.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const selectedId = selectedNode?.id;
  const showingSampleGraph = !uploadedArticles.length && !!fallbackArticles.length;
  const graphCountLabel = documentNode
    ? `${uploadedArticles.length} related articles`
    : loadingFallback
      ? 'Loading NYT sample...'
      : `${displayedArticles.length} NYT sample articles`;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Graph Explorer</h1>
            <p className="text-slate-400">
              Explore how NYT reporting clusters either around your document or across a general
              sample of embeddings.
            </p>
          </div>
          {!documentText && (
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="rounded-lg border border-compass-primary px-4 py-2 text-sm font-semibold text-compass-primary hover:bg-compass-primary/10"
            >
              Upload Document
            </button>
          )}
        </div>
      </header>

      {panelError && <p className="text-sm text-rose-400">{panelError}</p>}
      {fallbackError && !uploadedArticles.length && (
        <p className="text-sm text-rose-400">{fallbackError}</p>
      )}
      {showingSampleGraph && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          Viewing a sample slice of NYT articles. Upload a document to personalize the graph with
          similarity scores to your work.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Force Graph"
          actions={
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {graphCountLabel}
            </span>
          }
        >
          <div className="relative h-[640px] w-full overflow-hidden rounded-2xl border border-slate-900/60 bg-slate-950/40">
            {displayedArticles.length ? (
              <Graph
                articles={displayedArticles}
                documentNode={documentNode}
                onNodeClick={handleNodeClick}
                selectedNodeId={selectedId}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-400">
                {loadingFallback
                  ? 'Loading sample graph...'
                  : 'Upload a document to build a personalized graph.'}
              </div>
            )}
          </div>
        </Card>

        <Card title="Details & Insights">
          {documentNode && (!selectedNode || selectedNode.type === 'document') && (
            <div className="space-y-4 text-sm text-slate-300">
              <p className="text-slate-100">Uploaded document</p>
              <p className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-300">
                {documentText}
              </p>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loadingAnalysis}
                className="w-full rounded-lg bg-compass-primary/90 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-compass-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAnalysis ? 'Generating...' : 'Generate Insights'}
              </button>
            </div>
          )}

          {highlightedArticle && (
            <div className="space-y-3 text-sm text-slate-300">
              <div>
                <p className="text-xs uppercase text-slate-500">Article</p>
                <h2 className="text-lg font-semibold text-slate-50">
                  {highlightedArticle.headline}
                </h2>
              </div>
              <p className="text-slate-400">{highlightedArticle.abstract || highlightedArticle.snippet}</p>
              <div className="text-xs text-slate-500">
                <p>Section: {highlightedArticle.section_name || 'N/A'}</p>
                <p>Published: {highlightedArticle.pub_date || 'N/A'}</p>
                <p>
                  {documentNode
                    ? `Similarity: ${highlightedArticle.score?.toFixed(3)}`
                    : 'Similarity: Upload a document to calculate'}
                </p>
              </div>
              {highlightedArticle.web_url && (
                <a
                  href={highlightedArticle.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-compass-primary hover:underline"
                >
                  Open on NYT &rarr;
                </a>
              )}
            </div>
          )}

          {!documentNode && !highlightedArticle && (
            <p className="text-sm text-slate-400">
              Select a node in the graph to inspect article metadata. Upload a document to enable
              guardrailed insight generation.
            </p>
          )}

          {analysis && (
            <div className="mt-6 space-y-4 text-sm text-slate-200">
              <div>
                <p className="text-xs uppercase text-slate-500">Summary</p>
                <p className="whitespace-pre-line text-slate-300">{analysis.summary}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Insights</p>
                <p className="whitespace-pre-line text-slate-300">{analysis.insights}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Citations</p>
                <ul className="space-y-2">
                  {analysis.citations?.map((citation) => (
                    <li key={citation.id} className="text-slate-300">
                      <a
                        href={citation.web_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-compass-accent hover:underline"
                      >
                        {citation.headline}
                      </a>
                      <span className="block text-xs text-slate-500">{citation.reason}</span>
                    </li>
                  )) || <p className="text-slate-500">No citations provided.</p>}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Opposing / complementary views</p>
                <p className="whitespace-pre-line text-slate-300">
                  {analysis.opposingViews}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default GraphPage;


