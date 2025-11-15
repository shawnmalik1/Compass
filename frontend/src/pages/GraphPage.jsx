import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card.jsx';
import Graph from '../components/Graph.jsx';
import { CompassContext } from '../App.jsx';
import { analyzeDocument } from '../api/analyze.js';
import { fetchArticlesMetadata } from '../api/articles.js';
import KnowledgeMap from '../components/KnowledgeMap.jsx';
import MapSidebar from '../components/MapSidebar.jsx';
import {
  fetchMap,
  fetchFineCluster,
  searchArticles,
  uploadText as uploadMapText,
} from '../api.js';
import { normalizeArticles } from '../utils/articles.js';

const STANCE_STYLES = {
  supporting: { label: 'SUPPORTING', color: '#22c55e' },
  opposing: { label: 'OPPOSING', color: '#ff4500' },
  neutral: { label: 'NEUTRAL', color: '#94a3b8' },
};

function hexToRgba(hex, alpha = 0.3) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveStanceStyle(rawStance = '') {
  const key = rawStance.toLowerCase();
  if (key.includes('support')) return STANCE_STYLES.supporting;
  if (key.includes('oppose') || key.includes('oppos') || key.includes('contra'))
    return STANCE_STYLES.opposing;
  if (key.includes('neutral') || key.includes('mixed'))
    return STANCE_STYLES.neutral;
  return {
    label: (rawStance || 'PERSPECTIVE').toUpperCase(),
    color: STANCE_STYLES.neutral.color,
  };
}

function ViewpointCard({ item }) {
  const { label, color } = resolveStanceStyle(item.stance);
  const [spotlight, setSpotlight] = useState(null);

  const background = spotlight
    ? `radial-gradient(circle at ${spotlight.x}% ${spotlight.y}%, ${hexToRgba(color, 0.4)} 0%, transparent 45%), rgba(15,23,42,0.85)`
    : 'rgba(15,23,42,0.85)';

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setSpotlight({ x, y });
  };

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: color, background }}
      onMouseMove={handleMove}
      onMouseLeave={() => setSpotlight(null)}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color }}>
          {label}
        </p>
        {item.articles?.length ? (
          <span className="text-xs text-slate-500">
            {item.articles.length} article
            {item.articles.length > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-slate-200">{item.summary}</p>
      {item.articles?.length ? (
        <ul className="mt-3 space-y-2 text-xs text-slate-400">
          {item.articles.map((article) => (
            <li key={article.id}>
              <span className="block font-semibold text-slate-200">
                {article.headline}
              </span>
              {article.web_url && (
                <a
                  href={article.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-compass-accent hover:underline"
                >
                  Open article
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ViewpointComparison({ items = [] }) {
  if (!items.length) {
    return (
      <div>
        <p className="text-xs uppercase text-slate-500">
          Viewpoint comparison
        </p>
        <p className="mt-2 text-slate-500">
          No differing viewpoints available.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase text-slate-500">Viewpoint comparison</p>
      <div className="mt-3 flex flex-col gap-3">
        {items.map((item, index) => (
          <ViewpointCard key={`${item.stance || 'stance'}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function GraphPage() {
  const navigate = useNavigate();
  const {
    documentText,
    nearestArticles,
    analysis,
    setAnalysis,
    mapUploadResult,
  } = useContext(CompassContext);

  const [selectedNode, setSelectedNode] = useState(null);
  const [panelError, setPanelError] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [fallbackArticles, setFallbackArticles] = useState([]);
  const [fallbackError, setFallbackError] = useState('');
  const [loadingFallback, setLoadingFallback] = useState(false);

  const [mapData, setMapData] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [activeCoarseId, setActiveCoarseId] = useState(null);
  const [selectedFineCluster, setSelectedFineCluster] = useState(null);
  const [fineClusterArticles, setFineClusterArticles] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [mapSelectionSource, setMapSelectionSource] = useState(
    documentText ? 'document-upload' : 'none',
  );
  const [insightTab, setInsightTab] = useState('overview');
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [nodeAnalyses, setNodeAnalyses] = useState({});
  const [insightsSource, setInsightsSource] = useState({ type: 'document' });

  useEffect(() => {
    let cancelled = false;
    const loadMap = async () => {
      setMapLoading(true);
      setMapError('');
      try {
        const data = await fetchMap();
        if (cancelled) return;
        setMapData(data);
        setMapBounds(data.bounds);
      } catch (err) {
        if (!cancelled) {
          setMapError(err.message || 'Failed to load map data.');
        }
      } finally {
        if (!cancelled) {
          setMapLoading(false);
        }
      }
    };

    loadMap();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const uploadedArticles = useMemo(
    () => normalizeArticles(nearestArticles || []),
    [nearestArticles],
  );

  const activeCoarseCluster = useMemo(
    () =>
      mapData?.coarse_clusters.find((cluster) => cluster.id === activeCoarseId) ||
      null,
    [mapData, activeCoarseId],
  );

  const searchArticlesList = useMemo(
    () => normalizeArticles(searchResults?.results || []),
    [searchResults],
  );
  const fineClusterArticlesList = useMemo(
    () => normalizeArticles(fineClusterArticles || []),
    [fineClusterArticles],
  );
  const uploadNeighbors = useMemo(
    () => normalizeArticles(uploadResult?.neighbors || []),
    [uploadResult],
  );

  const displayedArticles = useMemo(() => {
    if (mapSelectionSource === 'search' && searchArticlesList.length) {
      return searchArticlesList;
    }
    if (mapSelectionSource === 'fine-cluster' && fineClusterArticlesList.length) {
      return fineClusterArticlesList;
    }
    if (mapSelectionSource === 'upload-text' && uploadNeighbors.length) {
      return uploadNeighbors;
    }
    if (mapSelectionSource === 'document-upload' && uploadedArticles.length) {
      return uploadedArticles;
    }
    if (uploadedArticles.length) {
      return uploadedArticles;
    }
    return fallbackArticles;
  }, [
    mapSelectionSource,
    searchArticlesList,
    fineClusterArticlesList,
    uploadNeighbors,
    uploadedArticles,
    fallbackArticles,
  ]);

  useEffect(() => {
    if (documentNode) {
      setSelectedNode((prev) => prev || documentNode);
    }
  }, [documentNode]);

  useEffect(() => {
    if (selectedNode?.type !== 'article') {
      return;
    }
    const exists = displayedArticles.some(
      (article) => article.id === selectedNode.id,
    );
    if (!exists && displayedArticles.length) {
      setSelectedNode({ id: displayedArticles[0].id, type: 'article' });
    }
  }, [displayedArticles, selectedNode]);

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
          setFallbackArticles(normalizeArticles(dataset));
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
  }, [
    documentText,
    uploadedArticles.length,
    fallbackArticles.length,
    loadingFallback,
  ]);

  const handleFineClusterClick = useCallback(
    async (fineClusterId, source = 'fine-cluster') => {
      if (fineClusterId == null) {
        return;
      }
      setMapError('');
      try {
        const detail = await fetchFineCluster(fineClusterId);
        setSelectedFineCluster(detail);
        setFineClusterArticles(detail.articles || []);
        setActiveCoarseId(detail.parent_coarse_id);
        setSearchResults(null);
        setMapSelectionSource(source);
      } catch (err) {
        setMapError(err.message || 'Failed to load subtopic.');
      }
    },
    [],
  );

  useEffect(() => {
    setInsightTab('overview');
  }, [analysis]);

  useEffect(() => {
    if (!mapUploadResult) {
      return;
    }
    const annotatedResult =
      mapUploadResult.source === 'document-upload'
        ? mapUploadResult
        : { ...mapUploadResult, source: 'document-upload' };
    setUploadResult(annotatedResult);
    if (mapUploadResult.fine_cluster_id != null) {
      handleFineClusterClick(
        mapUploadResult.fine_cluster_id,
        'document-upload',
      );
    } else {
      setMapSelectionSource('document-upload');
    }
  }, [mapUploadResult, handleFineClusterClick]);

  const handleSearch = useCallback(async (query) => {
    const value = (query || '').trim();
    if (!value) {
      return;
    }
    setMapError('');
    try {
      const results = await searchArticles(value);
      setSearchResults(results);
      setSelectedFineCluster(null);
      setFineClusterArticles([]);
      setActiveCoarseId(null);
      setMapSelectionSource('search');
    } catch (err) {
      setMapError(err.message || 'Search failed.');
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchResults(null);
    if (mapSelectionSource === 'search') {
      setMapSelectionSource(documentText ? 'document-upload' : 'none');
    }
  }, [mapSelectionSource, documentText]);

  const handleUpload = useCallback(
    async (text) => {
      const value = text.trim();
      if (!value) {
        return;
      }
      setMapError('');
      try {
        const response = await uploadMapText(value);
        const annotated = {
          ...response,
          neighbors: normalizeArticles(response.neighbors || []),
          source: 'upload-text',
        };
        setUploadResult(annotated);
        setSearchResults(null);
        setMapSelectionSource('upload-text');
        if (response.fine_cluster_id != null) {
          await handleFineClusterClick(response.fine_cluster_id, 'upload-text');
        }
      } catch (err) {
        setMapError(err.message || 'Upload failed.');
      }
    },
    [handleFineClusterClick],
  );

  const handleClearUpload = useCallback(() => {
    if (uploadResult?.source !== 'upload-text') {
      return;
    }
    if (mapUploadResult) {
      const annotated =
        mapUploadResult.source === 'document-upload'
          ? mapUploadResult
          : { ...mapUploadResult, source: 'document-upload' };
      setUploadResult(annotated);
      if (mapUploadResult.fine_cluster_id != null) {
        handleFineClusterClick(
          mapUploadResult.fine_cluster_id,
          'document-upload',
        );
      } else {
        setMapSelectionSource('document-upload');
      }
      return;
    }
    setUploadResult(null);
    setMapSelectionSource(documentText ? 'document-upload' : 'none');
    setSelectedFineCluster(null);
    setFineClusterArticles([]);
    setActiveCoarseId(null);
  }, [uploadResult, mapUploadResult, documentText, handleFineClusterClick]);

  const handleBackgroundClick = useCallback(() => {
    setActiveCoarseId(null);
    setSelectedFineCluster(null);
    setFineClusterArticles([]);
    setHoveredNode(null);
    if (mapSelectionSource === 'fine-cluster') {
      setMapSelectionSource(documentText ? 'document-upload' : 'none');
    }
  }, [mapSelectionSource, documentText]);

  const handleCoarseClusterClick = useCallback((clusterId) => {
    setActiveCoarseId(clusterId);
    setSelectedFineCluster(null);
    setFineClusterArticles([]);
    setHoveredNode(null);
    setMapSelectionSource('fine-cluster');
  }, []);

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
      setInsightsSource({ type: 'document' });
      setInsightTab('overview');
    } catch (err) {
      setPanelError(err.message || 'Failed to generate insights.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleCompareSelected = async () => {
    if (!documentText || !highlightedArticle) {
      setPanelError('Select an article and upload a document to compare viewpoints.');
      return;
    }
    setPanelError('');
    setLoadingComparison(true);
    try {
      const compareArticles = [
        highlightedArticle,
        ...uploadedArticles.filter(
          (article) => article.id !== highlightedArticle.id,
        ),
      ].slice(0, 20);
      const response = await analyzeDocument(
        documentText,
        compareArticles,
        {
          id: highlightedArticle.id,
          headline: highlightedArticle.headline,
          summary:
            highlightedArticle.abstract ||
            highlightedArticle.snippet ||
            '',
          section:
            highlightedArticle.section_name ||
            highlightedArticle.section ||
            '',
        },
      );
      setNodeAnalyses((prev) => ({
        ...prev,
        [highlightedArticle.id]: response,
      }));
      setInsightsSource({
        type: 'node',
        articleId: highlightedArticle.id,
      });
      setInsightTab('overview');
    } catch (err) {
      setPanelError(err.message || 'Failed to compare viewpoints.');
    } finally {
      setLoadingComparison(false);
    }
  };

  const highlightedArticle = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'article') {
      return null;
    }
    return (
      displayedArticles.find((article) => article.id === selectedNode.id) || null
    );
  }, [displayedArticles, selectedNode]);

  const activeArticleForOverlay =
    highlightedArticle ||
    (selectedNode?.type === 'article'
      ? selectedNode.data || selectedNode
      : null);
  const selectedArticleScore =
    typeof activeArticleForOverlay?.score === 'number'
      ? activeArticleForOverlay.score
      : typeof selectedNode?.score === 'number'
        ? selectedNode.score
        : null;

  const activeInsights = useMemo(() => {
    if (
      insightsSource?.type === 'node' &&
      insightsSource.articleId &&
      nodeAnalyses[insightsSource.articleId]
    ) {
      return nodeAnalyses[insightsSource.articleId];
    }
    return analysis;
  }, [analysis, insightsSource, nodeAnalyses]);
  const viewingNodeInsights =
    insightsSource?.type === 'node' &&
    Boolean(nodeAnalyses[insightsSource.articleId]);

  const selectedId = selectedNode?.id;
  const showingSampleGraph =
    !uploadedArticles.length &&
    !searchArticlesList.length &&
    !fineClusterArticlesList.length &&
    !uploadNeighbors.length &&
    !!fallbackArticles.length;

  const graphCountLabel = useMemo(() => {
    if (mapSelectionSource === 'search' && searchResults?.query) {
      return `Search: ${searchResults.query}`;
    }
    if (mapSelectionSource === 'fine-cluster' && selectedFineCluster) {
      return `Subtopic: ${selectedFineCluster.label}`;
    }
    if (mapSelectionSource === 'upload-text' && uploadResult) {
      return 'Closest articles to pasted text';
    }
    if (documentNode) {
      return `${uploadedArticles.length} related articles`;
    }
    if (loadingFallback) {
      return 'Loading NYT sample...';
    }
    if (fallbackArticles.length) {
      return `${fallbackArticles.length} NYT sample articles`;
    }
    return 'No graph data loaded';
  }, [
    mapSelectionSource,
    searchResults,
    selectedFineCluster,
    uploadResult,
    documentNode,
    uploadedArticles.length,
    loadingFallback,
    fallbackArticles.length,
  ]);

  const shouldShowDocumentNode =
    Boolean(documentNode) &&
    mapSelectionSource !== 'search' &&
    mapSelectionSource !== 'fine-cluster';

  const overviewText =
    activeInsights?.overview ||
    activeInsights?.summary ||
    'Overview unavailable.';
  const explainLikeFiveText =
    activeInsights?.explainLikeFive ||
    activeInsights?.explainLikeImFive ||
    'Friendly explanation unavailable.';
  const selectedInsightText =
    insightTab === 'overview' ? overviewText : explainLikeFiveText;
  const viewpointComparisons = Array.isArray(activeInsights?.viewpointComparison)
    ? activeInsights.viewpointComparison
    : [];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Graph Explorer</h1>
            <p className="text-slate-400">
              Explore NYT embeddings via the coarse map or your uploaded
              document&rsquo;s neighborhood.
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
      {mapError && mapLoading === false && !mapData && (
        <p className="text-sm text-rose-400">{mapError}</p>
      )}
      {showingSampleGraph && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          Viewing a sample slice of NYT articles. Upload a document or paste
          text to personalize the graph with similarity scores.
        </div>
      )}

      <Card
        title="Knowledge Map"
        actions={
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Kaggle NYT dataset (FastAPI)
          </span>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative overflow-auto rounded-2xl border border-slate-900/60 bg-slate-950/40">
            {mapData ? (
              <div className="min-w-[900px]">
                <KnowledgeMap
                  bounds={mapBounds}
                  coarseClusters={mapData.coarse_clusters}
                  fineClusters={mapData.fine_clusters}
                  activeCoarseId={activeCoarseId}
                  selectedFineCluster={selectedFineCluster}
                  fineClusterArticles={fineClusterArticles}
                  onCoarseClick={handleCoarseClusterClick}
                  onFineClick={handleFineClusterClick}
                  onBackgroundClick={handleBackgroundClick}
                  hoveredNode={hoveredNode}
                  setHoveredNode={setHoveredNode}
                />
              </div>
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-slate-400">
                {mapLoading ? 'Loading knowledge map...' : 'Map unavailable.'}
              </div>
            )}
            {mapLoading && (
              <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-2xl bg-slate-950/80 text-sm text-slate-300">
                Loading map...
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-900/60 bg-slate-950/60">
            <MapSidebar
              activeCoarseCluster={activeCoarseCluster}
              selectedFineCluster={selectedFineCluster}
              fineClusterArticles={fineClusterArticles}
              hoveredNode={hoveredNode}
              searchResults={searchResults}
              uploadResult={uploadResult}
              onSearch={handleSearch}
              onClearSearch={handleClearSearch}
              onUpload={handleUpload}
              onClearUpload={handleClearUpload}
              onFineClusterClick={handleFineClusterClick}
            />
          </div>
        </div>
        {mapError && mapData && (
          <p className="mt-4 text-sm text-rose-400">{mapError}</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Zoomed Topic Graph"
          actions={
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {graphCountLabel}
            </span>
          }
        >
          <div className="relative h-[640px] w-full overflow-hidden rounded-2xl border border-slate-900/60 bg-slate-950/40">
            {displayedArticles.length ? (
              <>
                <Graph
                  articles={displayedArticles}
                  documentNode={shouldShowDocumentNode ? documentNode : null}
                  onNodeClick={handleNodeClick}
                  selectedNodeId={selectedId}
                />
                {selectedNode?.type === 'article' && (
                  <>
                    <div className="pointer-events-auto absolute bottom-4 left-4 z-10 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={
                          documentText
                            ? handleCompareSelected
                            : () =>
                                setPanelError(
                                  'Upload a document to compare viewpoints.',
                                )
                        }
                        disabled={loadingComparison || !documentText}
                        className="rounded-full border border-compass-primary px-4 py-2 text-xs font-semibold text-compass-primary hover:bg-compass-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loadingComparison
                          ? 'Comparing…'
                          : 'Generate insights for this node'}
                      </button>
                      {!documentText && (
                        <p className="text-xs text-slate-500">
                          Upload a document to compare against nodes.
                        </p>
                      )}
                    </div>
                    <div className="pointer-events-none absolute bottom-4 right-4 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 shadow-lg">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Similarity score
                      </p>
                      <p className="text-lg font-semibold text-slate-100">
                        {documentText
                          ? selectedArticleScore != null
                            ? selectedArticleScore.toFixed(3)
                            : 'Unavailable'
                          : 'Upload a document'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {highlightedArticle?.headline ||
                          selectedNode.headline}
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-400">
                {loadingFallback
                  ? 'Loading sample graph...'
                  : 'Upload a document or use the knowledge map to populate this graph.'}
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
                className="inline-flex items-center justify-center rounded-full bg-compass-primary/90 px-6 py-2 text-sm font-semibold text-slate-900 hover:bg-compass-primary disabled:cursor-not-allowed disabled:opacity-60"
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
              <p className="text-slate-400">
                {highlightedArticle.abstract || highlightedArticle.snippet}
              </p>
              <div className="text-xs text-slate-500">
                <p>
                  Section:{' '}
                  {highlightedArticle.section_name ||
                    highlightedArticle.section ||
                    'N/A'}
                </p>
                <p>Published: {highlightedArticle.pub_date || 'N/A'}</p>
                <p>
                  {documentNode
                    ? `Similarity: ${
                        typeof highlightedArticle.score === 'number'
                          ? highlightedArticle.score.toFixed(3)
                          : 'Upload text for scores'
                      }`
                    : 'Similarity: Upload a document to calculate'}
                </p>
              </div>
              {highlightedArticle.web_url && (
                <a
                  href={highlightedArticle.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mr-3 text-sm font-semibold text-compass-primary hover:underline"
                >
                  Open on NYT
                </a>
              )}
              {documentText && (
                <button
                  type="button"
                  onClick={handleCompareSelected}
                  disabled={loadingComparison}
                  className="mt-3 inline-flex items-center justify-center rounded-full border border-compass-primary px-4 py-2 text-xs font-semibold text-compass-primary hover:bg-compass-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingComparison ? 'Comparing...' : 'Compare viewpoints'}
                </button>
              )}
            </div>
          )}

          {!documentNode && !highlightedArticle && (
            <p className="text-sm text-slate-400">
              Select a node in the graph to inspect article metadata. Upload a
              document or paste free-form text to enable guardrailed insight
              generation.
            </p>
          )}

          {activeInsights && (
            <div className="mt-6 space-y-6 text-sm text-slate-200">
              <div>
                <p className="text-xs uppercase text-slate-500">Insight views</p>
                <div className="mt-2 flex gap-2">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'eli5', label: "Explain Like I'm Five" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setInsightTab(tab.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        insightTab === tab.id
                          ? 'bg-compass-primary/90 text-slate-900'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 whitespace-pre-line text-slate-300">
                  {selectedInsightText}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Viewing insights for{' '}
                  {viewingNodeInsights ? 'selected article' : 'uploaded document'}
                </span>
                {viewingNodeInsights && (
                  <button
                    type="button"
                    onClick={() => setInsightsSource({ type: 'document' })}
                    className="text-compass-primary hover:underline"
                  >
                    Back to document insights
                  </button>
                )}
              </div>

              <ViewpointComparison items={viewpointComparisons} />

              <div>
                <p className="text-xs uppercase text-slate-500">Citations</p>
                <ul className="space-y-2">
                  {activeInsights.citations?.map((citation) => (
                    <li key={citation.id} className="text-slate-300">
                      <a
                        href={citation.web_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-compass-accent hover:underline"
                      >
                        {citation.headline}
                      </a>
                      <span className="block text-xs text-slate-500">
                        {citation.reason}
                      </span>
                    </li>
                  )) || <p className="text-slate-500">No citations provided.</p>}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default GraphPage;
