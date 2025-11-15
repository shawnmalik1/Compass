import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import Tooltip from "./Tooltip";

const WIDTH = 900;
const HEIGHT = 700;

// Helper: normalize coords to viewport
function normalizePositions(nodes) {
  if (!nodes || nodes.length === 0) return [];
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const xExtent = d3.extent(xs);
  const yExtent = d3.extent(ys);

  const xScale = d3.scaleLinear().domain(xExtent).range([50, WIDTH - 50]);
  const yScale = d3.scaleLinear().domain(yExtent).range([50, HEIGHT - 50]);

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
        style={{ background: "#050816", borderRadius: "12px" }}
      >
        <g transform={transform.toString()}>
          {clusterNodes.map((node) => {
            const isSelected =
              selectedCluster && node.id === selectedCluster.cluster_id;
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
                    fill: isSelected ? "#3b82f6" : "#6366f1",
                    opacity: 0.8,
                    stroke: "#e5e7eb",
                    strokeWidth: isSelected ? 2 : 1,
                  }}
                />
                <text
                  textAnchor="middle"
                  y={5}
                  style={{
                    fontSize: 10,
                    fill: "#e5e7eb",
                    pointerEvents: "none",
                  }}
                >
                  {node.label.slice(0, 22)}
                </text>
              </g>
            );
          })}

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
                  opacity: 0.9,
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
