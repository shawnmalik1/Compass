import React, { useState } from 'react';

function UploadPanel({ onUpload, uploadResult, onFineClusterClick, onClear }) {
  const [text, setText] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !onUpload) {
      return;
    }
    onUpload(value);
  };

  const handleClearInput = () => {
    setText('');
  };

  const hasResult = Boolean(uploadResult);
  const canClear = hasResult && uploadResult.source === 'upload-text';

  return (
    <div className="upload-panel">
      <h3>Search Knowledge Map</h3>
      <p className="small">
        Paste an article, idea, or essay, or enter keywords. We will show where
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
              onClick={handleClearInput}
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
                  onFineClusterClick(
                    uploadResult.fine_cluster_id,
                    uploadResult.source,
                  )
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
