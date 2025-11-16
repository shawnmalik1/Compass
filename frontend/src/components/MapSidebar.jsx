import React from 'react';
import SearchBar from './SearchBar.jsx';
import UploadPanel from './UploadPanel.jsx';
import ArticleList from './ArticleList.jsx';

function MapSidebar({
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
}) {
  const showTopicPreview =
    hoveredNode && hoveredNode.type === 'coarse' && !selectedFineCluster;

  return (
    <div className="sidebar">
      <h1>Granular Knowledge Map</h1>
      <p className="tagline">
        Zoom from big-picture themes down to specific subtopics and articles.
      </p>

      <SearchBar onSearch={onSearch} onClear={onClearSearch} />

      {searchResults && (
        <ArticleList
          title={`Search: "${searchResults.query}"`}
          articles={searchResults.results}
        />
      )}

      {!searchResults && selectedFineCluster && (
        <ArticleList
          title={`Subtopic: ${selectedFineCluster.label}`}
          articles={(fineClusterArticles || []).slice(0, 80)}
        />
      )}

      {showTopicPreview && !searchResults && (
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
    </div>
  );
}

export default MapSidebar;
