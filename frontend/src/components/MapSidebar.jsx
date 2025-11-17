import React from 'react';
import UploadPanel from './UploadPanel.jsx';
import ArticleList from './ArticleList.jsx';

function MapSidebar({
  activeCoarseCluster,
  selectedFineCluster,
  fineClusterArticles,
  hoveredNode,
  uploadResult,
  mappedArticles = [],
  facultyMembers = [],
  facultyLoading = false,
  facultyError = '',
  onUpload,
  onClearUpload,
  onFineClusterClick,
  onGenerateCitation,
  citationState,
}) {
  const showTopicPreview =
    hoveredNode && hoveredNode.type === 'coarse' && !selectedFineCluster;
  const showUploadArticles =
    uploadResult?.source === 'upload-text' && mappedArticles.length > 0;

  return (
    <div className="sidebar">
      <h1>Granular Knowledge Map</h1>
      <p className="tagline">
        Zoom from big-picture themes down to specific subtopics and articles.
      </p>

      {selectedFineCluster && (
        <ArticleList
          title={`Subtopic: ${selectedFineCluster.label}`}
          articles={(fineClusterArticles || []).slice(0, 80)}
          onCite={onGenerateCitation}
          citationState={citationState}
        />
      )}

      {selectedFineCluster && (
        <div className="faculty-section">
          <h3>Faculty working on "{selectedFineCluster.label}"</h3>
          {facultyLoading && (
            <p className="muted">Searching UVA faculty directory…</p>
          )}
          {!facultyLoading && facultyError && (
            <p className="error-text">{facultyError}</p>
          )}
          {!facultyLoading &&
            !facultyError &&
            facultyMembers.length === 0 && (
              <p className="muted">
                No matching faculty found for this topic yet.
              </p>
            )}
          {!facultyLoading && !facultyError && facultyMembers.length > 0 && (
            <ul className="faculty-list">
              {facultyMembers.slice(0, 6).map((member) => (
                <li key={`${member.name}-${member.email}`} className="faculty-member">
                  <div className="headline">{member.name || 'Unnamed faculty'}</div>
                  {member.department && (
                    <div className="meta">{member.department}</div>
                  )}
                  {member.email && (
                    <a href={`mailto:${member.email}`}>{member.email}</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!selectedFineCluster && showUploadArticles && (
        <ArticleList
          title="Mapped text matches"
          articles={mappedArticles}
          onCite={onGenerateCitation}
          citationState={citationState}
        />
      )}

      {showTopicPreview && !selectedFineCluster && !showUploadArticles && (
        <div className="hover-info">
          <h3>Topic preview</h3>
          <div className="hover-label">{hoveredNode.label}</div>
          <div className="hover-count">
            {hoveredNode.count} articles in this area
          </div>
        </div>
      )}

      {activeCoarseCluster &&
        !selectedFineCluster &&
        !showUploadArticles && (
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

export default MapSidebar;
