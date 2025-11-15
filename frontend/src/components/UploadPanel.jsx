import React, { useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

function UploadPanel({ onUpload, uploadResult, onFineClusterClick, onClear }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Please enter or upload some text first.");
      return;
    }
    setError("");
    onUpload(text);
  }

  function handleUploadClick() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function extractTextFromPdf(file) {
    const buffer = await file.arrayBuffer();
    const typedarray = new Uint8Array(buffer);
    const pdf = await getDocument({ data: typedarray }).promise;
    let combinedText = "";
    const pages = Math.min(pdf.numPages, 10);
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str || "").join(" ");
      combinedText += `${pageText}\n`;
    }
    return combinedText.slice(0, 4000);
  }

  async function handleFileChange(event) {
    setError("");
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    try {
      if (ext === "pdf") {
        const pdfText = await extractTextFromPdf(file);
        if (!pdfText.trim()) throw new Error("No text found in PDF.");
        setText(pdfText);
        onUpload(pdfText);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setText(reader.result.slice(0, 4000));
            onUpload(reader.result);
          }
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to read that file. Try a PDF or text document.");
    }
  }

  return (
    <div className="upload-panel">
      <h3>Search Knowledge Map</h3>
      <p className="small">
        Upload/paste an article, idea, essay, or enter keywords. We’ll show where it lands in the
        knowledge map.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          rows={5}
          placeholder="Paste text here..."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError("");
        }}
      />
        {error && <div className="upload-error">{error}</div>}
        <div className="upload-actions">
          <button type="submit">Map this text</button>
          <button type="button" className="secondary" onClick={handleUploadClick}>
            Upload document
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          accept=".txt,.md,.rtf,.json,.csv,.pdf"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
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
