import React, { useState } from "react";

function UploadPanel({ onUpload, uploadResult, onClusterClick }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onUpload(text);
  }

  return (
    <div className="upload-panel">
      <h3>Upload / Paste Document</h3>
      <p className="small">
        Paste an article, reading, or essay. We’ll show where it lands in the
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
            Closest topic:
            <button
              type="button"
              onClick={() => onClusterClick(uploadResult.cluster_id)}
            >
              {uploadResult.cluster_label}
            </button>
          </div>
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
        </div>
      )}
    </div>
  );
}

export default UploadPanel;
