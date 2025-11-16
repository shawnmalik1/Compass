import React from "react";
import UploadPanel from "./UploadPanel";
import ArticleList from "./ArticleList";

function Sidebar({
  activeCoarseCluster,
  selectedFineCluster,
  fineClusterArticles,
  hoveredNode,
  uploadResult,
  onUpload,
  onClearUpload,
  onFineClusterClick,
  onGenerateCitation,
  citationState,
}) {
  const isCoarseHover = hoveredNode && hoveredNode.type === "coarse";

  return (
    <div className="sidebar">
      <h1>Granular Knowledge Map</h1>
      <p className="tagline">
        Zoom from big-picture themes down to specific subtopics and articles.
      </p>

      {selectedFineCluster && (
        <ArticleList
          title={`Subtopic: ${selectedFineCluster.label}`}
          articles={fineClusterArticles.slice(0, 80)}
          onCite={onGenerateCitation}
          citationState={citationState}
        />
      )}

      {isCoarseHover && !selectedFineCluster && (
        <div className="hover-info">
          <h3>Topic preview</h3>
          <div className="hover-label">{hoveredNode.label}</div>
          <div className="hover-count">
            {hoveredNode.count} articles in this area
          </div>
        </div>
      )}

      {activeCoarseCluster && !selectedFineCluster && (
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
    </div>
  );
}

export default Sidebar;
