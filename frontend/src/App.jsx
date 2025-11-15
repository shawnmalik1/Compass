import React, { useEffect, useMemo, useState } from "react";
import { fetchMap, fetchFineCluster, searchArticles, uploadText } from "./api";
import KnowledgeMap from "./components/KnowledgeMap";
import Sidebar from "./components/Sidebar";

function App() {
  const [mapData, setMapData] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [activeCoarseId, setActiveCoarseId] = useState(null);
  const [selectedFineCluster, setSelectedFineCluster] = useState(null);
  const [fineClusterArticles, setFineClusterArticles] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);

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

  async function handleSearch(query) {
    if (!query.trim()) return;
    try {
      const res = await searchArticles(query.trim());
      setSearchResults(res);
      // keep currently selected cluster so clearing search restores it
    } catch (err) {
      console.error(err);
    }
  }

  function handleClearSearch() {
    setSearchResults(null);
  }

  function handleBackgroundClick() {
    setActiveCoarseId(null);
    setSelectedFineCluster(null);
    setFineClusterArticles([]);
    setHoveredNode(null);
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
      setSearchResults(null);
    } catch (err) {
      console.error(err);
    }
  }

  function handleClearUpload() {
    setUploadResult(null);
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
        searchResults={searchResults}
        uploadResult={uploadResult}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onUpload={handleUpload}
        onClearUpload={handleClearUpload}
        onFineClusterClick={handleFineClusterClick}
      />
    </div>
  );
}

export default App;
