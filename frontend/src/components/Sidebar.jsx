import React from "react";
import SearchBar from "./SearchBar";
import UploadPanel from "./UploadPanel";
import ArticleList from "./ArticleList";

function Sidebar({
  activeCoarseCluster,
  selectedFineCluster,
  fineClusterArticles,
  hoveredNode,
  searchResults,
  uploadResult,
  onSearch,
  onClearSearch,
  onUpload,
  onClearUpload,
  onFineClusterClick,
  facultyState,
  onRetryFaculty,
}) {
  const isCoarseHover = hoveredNode && hoveredNode.type === "coarse";
  const showFaculty =
    facultyState &&
    (facultyState.status === "loading" ||
      facultyState.status === "success" ||
      facultyState.status === "error");

  return (
    <div className="sidebar">
      <h1>Granular Knowledge Map</h1>
      <p className="tagline">
        Zoom from big-picture themes down to specific subtopics and articles.
      </p>

      <SearchBar onSearch={onSearch} onClear={onClearSearch} />

      {searchResults && (
        <ArticleList
          title={`Search: “${searchResults.query}”`}
          articles={searchResults.results}
        />
      )}

      {!searchResults && selectedFineCluster && (
        <ArticleList
          title={`Subtopic: ${selectedFineCluster.label}`}
          articles={fineClusterArticles.slice(0, 80)}
        />
      )}

      {isCoarseHover && !selectedFineCluster && !searchResults && (
        <div className="hover-info">
          <h3>Topic preview</h3>
          <div className="hover-label">{hoveredNode.label}</div>
          <div className="hover-count">
            {hoveredNode.count} articles in this area
          </div>
        </div>
      )}

      {activeCoarseCluster && !selectedFineCluster && !searchResults && (
        <div className="hover-info">
          <h3>Selected topic</h3>
          <div className="hover-label">{activeCoarseCluster.label}</div>
          <div className="hover-count">
            {activeCoarseCluster.count} articles across this topic
          </div>
        </div>
      )}

      <UploadPanel
        onUpload={onUpload}
        onClear={onClearUpload}
        uploadResult={uploadResult}
        onFineClusterClick={onFineClusterClick}
      />

      {showFaculty && (
        <div className="hover-info" style={{ marginTop: 12 }}>
          <h3>Faculty leads</h3>
          {facultyState.status === "loading" && (
            <div className="small">Fetching faculty matches…</div>
          )}
          {facultyState.status === "error" && (
            <div className="small" style={{ color: "#f59e0b" }}>
              {facultyState.error || "Unable to fetch faculty."}{" "}
              {onRetryFaculty && (
                <button
                  type="button"
                  onClick={onRetryFaculty}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#60a5fa",
                    cursor: "pointer",
                    padding: 0,
                    marginLeft: 4,
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {facultyState.status === "success" && !facultyState.results?.length && (
            <div className="small">No faculty found for these keywords.</div>
          )}
          {facultyState.status === "success" && facultyState.results?.length > 0 && (
            <ul className="article-list">
              {facultyState.results.slice(0, 12).map((entry, idx) => (
                <li key={`${entry.name || "faculty"}-${idx}`} className="article">
                  <div className="headline">{entry.name || "Unknown"}</div>
                  <div className="meta">
                    {entry.department || "Department N/A"}
                    {entry.email ? ` • ${entry.email}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
