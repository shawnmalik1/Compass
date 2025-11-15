import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import Tooltip from "./Tooltip";

const WIDTH = 900;
const HEIGHT = 700;

// Normalize coords to viewport
function normalizePositions(nodes) {
  if (!nodes || nodes.length === 0) return [];
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const xExtent = d3.extent(xs);
  const yExtent = d3.extent(ys);

  const xScale = d3.scaleLinear().domain(xExtent).range([80, WIDTH - 80]);
  const yScale = d3.scaleLinear().domain(yExtent).range([80, HEIGHT - 80]);

  return nodes.map((n) => ({
    ...n,
    xNorm: xScale(n.x),
    yNorm: yScale(n.y),
  }));
}

function KnowledgeMap({
  clusters,
  selectedCluster,
  onClusterClick,
  hoveredNode,
  setHoveredNode,
  clusterArticles,
}) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState(d3.zoomIdentity);

  const clusterNodes = normalizePositions(clusters || []);
  const articleNodes = selectedCluster
    ? normalizePositions(clusterArticles || [])
    : [];

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const zoom = d3
      .zoom()
      .scaleExtent([0.4, 5])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    svg.call(zoom);
  }, []);

  return (
    <div className="knowledge-map">
      <svg
        ref={svgRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ background: "#020617", borderRadius: "24px" }}
      >
        <defs>
          <radialGradient id="clusterGradient" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#6366f1" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.98" />
          </radialGradient>
          <filter id="clusterGlow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={transform.toString()}>
          {/* Topic bubbles */}
          {clusterNodes.map((node) => {
            const isSelected =
              selectedCluster && node.id === selectedCluster.cluster_id;
            const labelLines = node.label.split(" / ").slice(0, 2);

            return (
              <g
                key={node.id}
                transform={`translate(${node.xNorm}, ${node.yNorm})`}
                onClick={() => onClusterClick(node.id)}
                onMouseEnter={() =>
                  setHoveredNode({
                    type: "cluster",
                    ...node,
                  })
                }
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  r={node.size}
                  style={{
                    fill: "url(#clusterGradient)",
                    opacity: isSelected ? 1 : 0.85,
                    stroke: isSelected ? "#e5e7eb" : "#1d4ed8",
                    strokeWidth: isSelected ? 2.4 : 1.4,
                    filter: "url(#clusterGlow)",
                  }}
                />
                <text
                  textAnchor="middle"
                  y={-2}
                  style={{
                    fontSize: 10,
                    fill: "#e5e7eb",
                    pointerEvents: "none",
                  }}
                >
                  {labelLines.map((line, i) => (
                    <tspan key={i} x={0} dy={i === 0 ? 0 : 11}>
                      {line.slice(0, 18)}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}

          {/* Article points in selected cluster */}
          {articleNodes.length > 0 &&
            articleNodes.map((a) => (
              <circle
                key={a.id}
                cx={a.xNorm}
                cy={a.yNorm}
                r={4}
                onMouseEnter={() =>
                  setHoveredNode({
                    type: "article",
                    ...a,
                  })
                }
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  fill: "#f97316",
                  opacity: 0.95,
                  cursor: "default",
                }}
              />
            ))}
        </g>
      </svg>
      <Tooltip hoveredNode={hoveredNode} />
    </div>
  );
}

export default KnowledgeMap;
