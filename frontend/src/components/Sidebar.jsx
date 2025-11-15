import React from "react";
import SearchBar from "./SearchBar";
import UploadPanel from "./UploadPanel";
import ArticleList from "./ArticleList";

function Sidebar({
  selectedCluster,
  clusterArticles,
  hoveredNode,
  searchResults,
  uploadResult,
  onSearch,
  onUpload,
  onClusterClick,
}) {
  const isClusterHovered = hoveredNode && hoveredNode.type === "cluster";

  return (
    <div className="sidebar">
      <h1>Granular Knowledge Map</h1>
      <p className="tagline">
        Turn scattered NYT articles into an interactive, zoomable map of topics.
      </p>

      <SearchBar onSearch={onSearch} />

      {searchResults && (
        <ArticleList
          title={`Search: “${searchResults.query}”`}
          articles={searchResults.results}
        />
      )}

      {!searchResults && selectedCluster && (
        <ArticleList
          title={`Cluster: ${selectedCluster.label}`}
          articles={clusterArticles.slice(0, 50)}
        />
      )}

      {isClusterHovered && !selectedCluster && (
        <div className="hover-info">
          <h3>Topic preview</h3>
          <div className="hover-label">{hoveredNode.label}</div>
          <div className="hover-count">
            {hoveredNode.count} articles in this area
          </div>
        </div>
      )}

      <UploadPanel
        onUpload={onUpload}
        uploadResult={uploadResult}
        onClusterClick={onClusterClick}
      />
    </div>
  );
}

export default Sidebar;
