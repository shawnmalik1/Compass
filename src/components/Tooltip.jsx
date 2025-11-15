import React from "react";

function Tooltip({ hoveredNode }) {
  if (!hoveredNode) return null;

  const style = {
    position: "fixed",
    left: 20,
    bottom: 20,
    background: "rgba(15,23,42,0.95)",
    color: "#e5e7eb",
    padding: "10px 12px",
    borderRadius: "8px",
    maxWidth: "420px",
    fontSize: 13,
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
    zIndex: 50,
  };

  if (hoveredNode.type === "cluster") {
    return (
      <div style={style}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Topic</div>
        <div style={{ marginBottom: 4 }}>{hoveredNode.label}</div>
        <div style={{ opacity: 0.8, fontSize: 12 }}>
          {hoveredNode.count} articles in this cluster
        </div>
      </div>
    );
  }

  return (
    <div style={style}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {hoveredNode.headline}
      </div>
      {hoveredNode.section && (
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>
          {hoveredNode.section} • {hoveredNode.pub_date}
        </div>
      )}
      {hoveredNode.abstract && (
        <div style={{ fontSize: 12 }}>
          {hoveredNode.abstract.slice(0, 230)}
          {hoveredNode.abstract.length > 230 ? "…" : ""}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
