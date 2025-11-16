import React, { useEffect, useMemo, useState } from "react";
import { fetchMap, fetchFineCluster, uploadText, createCitation } from "./api";
import KnowledgeMap from "./components/KnowledgeMap";
import Sidebar from "./components/Sidebar";
import Landing from "./components/Landing";

function App() {
  const [mapData, setMapData] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [activeCoarseId, setActiveCoarseId] = useState(null);
  const [selectedFineCluster, setSelectedFineCluster] = useState(null);
  const [fineClusterArticles, setFineClusterArticles] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [citationState, setCitationState] = useState({
    articleId: null,
    text: "",
    loading: false,
    error: null,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchMap();
        setMapData(data);
        setMapBounds(data.bounds);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeCoarseCluster = useMemo(() => {
    if (!mapData || activeCoarseId == null) return null;
    return (
      mapData.coarse_clusters.find((cluster) => cluster.id === activeCoarseId) ||
      null
    );
  }, [mapData, activeCoarseId]);

  function handleBackgroundClick() {
    setActiveCoarseId(null);
    setSelectedFineCluster(null);
    setFineClusterArticles([]);
    setHoveredNode(null);
    setCitationState({ articleId: null, text: "", loading: false, error: null });
  }

  function handleCoarseClusterClick(clusterId) {
    setActiveCoarseId(clusterId);
    setSelectedFineCluster(null);
    setFineClusterArticles([]);
    setHoveredNode(null);
  }

  async function handleFineClusterClick(fineClusterId) {
    try {
      const detail = await fetchFineCluster(fineClusterId);
      setSelectedFineCluster(detail);
      setFineClusterArticles(detail.articles);
      setActiveCoarseId(detail.parent_coarse_id);
      setCitationState({ articleId: null, text: "", loading: false, error: null });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpload(text) {
    if (!text.trim()) return;
    try {
      const res = await uploadText(text.trim());
      setUploadResult(res);
      await handleFineClusterClick(res.fine_cluster_id);
    } catch (err) {
      console.error(err);
    }
  }

  function handleClearUpload() {
    setUploadResult(null);
  }

  async function handleGenerateCitation(article) {
    if (!article) return;
    setCitationState({
      articleId: article.id,
      text: "",
      loading: true,
      error: null,
    });
    try {
      const res = await createCitation(article);
      setCitationState({
        articleId: article.id,
        text: res.citation,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error(err);
      setCitationState({
        articleId: article.id,
        text: "",
        loading: false,
        error: "Failed to generate citation.",
      });
    }
  }

  if (showLanding) {
    return (
      <Landing
        mapReady={Boolean(mapData)}
        onEnter={() => setShowLanding(false)}
      />
    );
  }

  return (
    <div className="app-container">
      <div className="map-container">
        {loading && <div className="overlay">Loading map…</div>}
        {mapData && (
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
        )}
      </div>
      <Sidebar
        activeCoarseCluster={activeCoarseCluster}
        selectedFineCluster={selectedFineCluster}
        fineClusterArticles={fineClusterArticles}
        hoveredNode={hoveredNode}
        uploadResult={uploadResult}
        onUpload={handleUpload}
        onClearUpload={handleClearUpload}
        onFineClusterClick={handleFineClusterClick}
        onGenerateCitation={handleGenerateCitation}
        citationState={citationState}
      />
    </div>
  );
}

export default App;
