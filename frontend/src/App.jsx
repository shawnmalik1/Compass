import React, { useEffect, useState } from "react";
import { fetchMap, fetchCluster, searchArticles, uploadText } from "./api";
import KnowledgeMap from "./components/KnowledgeMap";
import Sidebar from "./components/Sidebar";

function App() {
  const [mapData, setMapData] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [clusterArticles, setClusterArticles] = useState([]);
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleClusterClick(clusterId) {
    try {
      const detail = await fetchCluster(clusterId);
      setSelectedCluster(detail);
      setClusterArticles(detail.articles);
      setSearchResults(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSearch(query) {
    if (!query.trim()) return;
    try {
      const res = await searchArticles(query.trim());
      setSearchResults(res);
      setSelectedCluster(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpload(text) {
    if (!text.trim()) return;
    try {
      const res = await uploadText(text.trim());
      setUploadResult(res);
      const detail = await fetchCluster(res.cluster_id);
      setSelectedCluster(detail);
      setClusterArticles(detail.articles);
      setSearchResults(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="app-container">
      <div className="map-container">
        {loading && <div className="overlay">Loading map…</div>}
        {mapData && (
          <KnowledgeMap
            clusters={mapData.clusters}
            selectedCluster={selectedCluster}
            onClusterClick={handleClusterClick}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
            clusterArticles={clusterArticles}
          />
        )}
      </div>
      <Sidebar
        selectedCluster={selectedCluster}
        clusterArticles={clusterArticles}
        hoveredNode={hoveredNode}
        searchResults={searchResults}
        uploadResult={uploadResult}
        onSearch={handleSearch}
        onUpload={handleUpload}
        onClusterClick={handleClusterClick}
      />
    </div>
  );
}

export default App;
