import React, { useState } from "react";

function UploadPanel({ onUpload, uploadResult, onFineClusterClick, onClear }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onUpload(text);
  }

  return (
    <div className="upload-panel">
      <h3>Search Knowledge Map</h3>
      <p className="small">
        Paste an article, idea, essay, or enter keywords. We’ll show where it lands in the
        knowledge map.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          rows={5}
          placeholder="Paste text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Map this text</button>
      </form>

      {uploadResult && (
        <div className="upload-result">
          <div className="tag">
            Closest subtopic:
            <button
              type="button"
              onClick={() =>
                onFineClusterClick(uploadResult.fine_cluster_id)
              }
            >
              {uploadResult.fine_cluster_label}
            </button>
          </div>
          {uploadResult.parent_coarse_label && (
            <div className="meta">
              Within topic: {uploadResult.parent_coarse_label}
            </div>
          )}
          <h4>Closest articles</h4>
          <ul>
            {uploadResult.neighbors.slice(0, 5).map((n) => (
              <li key={n.id}>
                <div className="headline">{n.headline}</div>
                {n.section && (
                  <div className="meta">
                    {n.section} • {n.pub_date}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              style={{
                background: "none",
                border: "none",
                color: "#60a5fa",
                cursor: "pointer",
                padding: 0,
                marginTop: 8,
              }}
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
