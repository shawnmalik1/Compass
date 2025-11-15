import React, { useState } from 'react';

function UploadPanel({
  onUpload,
  uploadResult,
  onFineClusterClick,
  onClear,
}) {
  const [text, setText] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      return;
    }
    if (onUpload) {
      onUpload(value);
    }
  };

  const hasResult = Boolean(uploadResult);
  const canClear = hasResult && uploadResult.source === 'upload-text';

  return (
    <div className="upload-panel">
      <h3>Search Knowledge Map</h3>
      <p className="small">
        Paste an article, reading, essay, or enter keywords. We will show where
        it lands in the knowledge map.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          rows={5}
          placeholder="Paste text here..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="button-row">
          <button type="submit" disabled={!text.trim()}>
            Map this text
          </button>
          {text && (
            <button
              type="button"
              className="secondary"
              onClick={() => setText('')}
            >
              Clear input
            </button>
          )}
        </div>
      </form>

      {hasResult && (
        <div className="upload-result">
          <div className="tag">
            Closest subtopic:
            {onFineClusterClick && uploadResult.fine_cluster_id != null && (
              <button
                type="button"
                onClick={() =>
                  onFineClusterClick(uploadResult.fine_cluster_id, uploadResult.source)
                }
              >
                {uploadResult.fine_cluster_label}
              </button>
            )}
          </div>
          {uploadResult.parent_coarse_label && (
            <div className="meta">
              Within topic: {uploadResult.parent_coarse_label}
            </div>
          )}
          <h4>Closest articles</h4>
          <ul>
            {(uploadResult.neighbors || []).slice(0, 5).map((neighbor) => (
              <li key={neighbor.id}>
                <div className="headline">{neighbor.headline}</div>
                {(neighbor.section_name || neighbor.section || neighbor.pub_date) && (
                  <div className="meta">
                    {neighbor.section_name || neighbor.section || 'Unknown section'}
                    {neighbor.pub_date ? ` - ${neighbor.pub_date}` : ''}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canClear && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="secondary"
              style={{ marginTop: 8 }}
            >
              Clear result
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadPanel;
