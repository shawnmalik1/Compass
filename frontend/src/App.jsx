import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchMap, fetchFineCluster, fetchFaculty, searchArticles, uploadText } from "./api";
import KnowledgeMap from "./components/KnowledgeMap";
import Sidebar from "./components/Sidebar";
import Landing from "./components/Landing";

function labelsAsKeywords(labels = []) {
  const seen = new Set();
  const compact = [];
  labels
    .filter(Boolean)
    .forEach((label) => {
      const parts = label
        .split(/[\/,]/g)
        .map((part) => part.trim())
        .filter(Boolean);
      parts.forEach((part) => {
        if (seen.has(part)) return;
        seen.add(part);
        compact.push(part);
      });
    });
  return compact;
}

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
  const [showLanding, setShowLanding] = useState(true);
  const [facultyState, setFacultyState] = useState({
    status: "idle",
    results: [],
    keywords: [],
    sourceLabel: "",
    error: "",
  });
  const facultyRequestRef = useRef(0);
  const facultyLabelsRef = useRef([]);

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

  const resetFacultyState = () => {
    setFacultyState({
      status: "idle",
      results: [],
      keywords: [],
      sourceLabel: "",
      error: "",
    });
    facultyLabelsRef.current = [];
  };

  const startFacultyLookup = (labels = []) => {
    const keywords = labelsAsKeywords(labels);
    const labelSummary = labels.filter(Boolean).join(" / ");
    facultyLabelsRef.current = labels;

    if (!keywords.length) {
      setFacultyState((prev) => ({
        ...prev,
        status: "success",
        results: [],
        keywords: [],
        sourceLabel: labelSummary,
        error: "",
      }));
      return;
    }

    const requestId = facultyRequestRef.current + 1;
    facultyRequestRef.current = requestId;
    setFacultyState({
      status: "loading",
      results: [],
      keywords,
      sourceLabel: labelSummary,
      error: "",
    });

    fetchFaculty(keywords)
      .then((res) => {
        if (facultyRequestRef.current !== requestId) return;
        setFacultyState({
          status: "success",
          results: res.results || [],
          keywords: res.keywords || keywords,
          sourceLabel: labelSummary,
          error: "",
        });
      })
      .catch((err) => {
        if (facultyRequestRef.current !== requestId) return;
        setFacultyState({
          status: "error",
          results: [],
          keywords,
          sourceLabel: labelSummary,
          error: err.message || "Failed to load faculty",
        });
      });
  };

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
    resetFacultyState();
  }

  function handleCoarseClusterClick(clusterId) {
    const coarseLabel =
      mapData?.coarse_clusters?.find((cluster) => cluster.id === clusterId)?.label ||
      `Topic ${clusterId}`;
    setActiveCoarseId(clusterId);
    setSelectedFineCluster(null);
    setFineClusterArticles([]);
    setHoveredNode(null);
    startFacultyLookup([coarseLabel]);
  }

  async function handleFineClusterClick(fineClusterId) {
    try {
      const detail = await fetchFineCluster(fineClusterId);
      setSelectedFineCluster(detail);
      setFineClusterArticles(detail.articles);
      setActiveCoarseId(detail.parent_coarse_id);
      startFacultyLookup([detail.label]);
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

  function handleRetryFaculty() {
    if (!facultyLabelsRef.current.length) return;
    startFacultyLookup(facultyLabelsRef.current);
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
        searchResults={searchResults}
        uploadResult={uploadResult}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onUpload={handleUpload}
        onClearUpload={handleClearUpload}
        onFineClusterClick={handleFineClusterClick}
        facultyState={facultyState}
        onRetryFaculty={handleRetryFaculty}
      />
    </div>
  );
}

export default App;
