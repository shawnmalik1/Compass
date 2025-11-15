import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import Tooltip from "./Tooltip";

const WIDTH = 900;
const HEIGHT = 700;
const PADDING = 80;

const TOPIC_COLOR_RULES = [
  {
    keywords: [
      "health",
      "medical",
      "medicine",
      "disease",
      "care",
      "hospital",
      "doctor",
      "virus",
      "covid",
      "science",
      "research",
    ],
    color: "#10b981",
  },
  {
    keywords: ["education", "school", "college", "university", "student", "teacher", "learning"],
    color: "#f43f5e",
  },
  {
    keywords: ["movie", "film", "music", "show", "entertainment", "tv", "culture", "art", "theater"],
    color: "#ec4899",
  },
  {
    keywords: ["sport", "game", "season", "team", "player", "football", "basketball", "baseball", "soccer", "tennis"],
    color: "#f97316",
  },
  {
    keywords: ["business", "market", "economy", "bank", "deal", "company", "finance", "financial", "trade", "stock"],
    color: "#0ea5e9",
  },
  {
    keywords: ["tech", "technology", "software", "internet", "digital", "cyber", "data", "ai", "robot", "device"],
    color: "#8b5cf6",
  },
  {
    keywords: ["politic", "president", "election", "congress", "senate", "government", "policy", "mayor", "campaign"],
    color: "#ef4444",
  },
  {
    keywords: ["world", "global", "foreign", "china", "russia", "iraq", "military", "conflict", "war", "international"],
    color: "#14b8a6",
  },
  {
    keywords: ["environment", "climate", "energy", "weather", "storm", "wildfire", "planet", "water"],
    color: "#84cc16",
  },
  {
    keywords: ["crime", "police", "arrest", "investigation", "trial", "court", "murder", "shooting", "law"],
    color: "#facc15",
  },
];

const COLOR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#14b8a6",
  "#22d3ee",
  "#10b981",
  "#84cc16",
  "#f97316",
  "#ef4444",
  "#ec4899",
];

function fallbackColor(label = "default") {
  let hash = 0;
  const value = label || "default";
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[idx];
}

function getTopicColor(label) {
  if (!label) return fallbackColor("unknown");
  const lower = label.toLowerCase();
  const rule = TOPIC_COLOR_RULES.find((item) =>
    item.keywords.some((keyword) => lower.includes(keyword))
  );
  return rule ? rule.color : fallbackColor(lower);
}

function adjustColor(hex, fn) {
  const parsed = d3.color(hex);
  if (!parsed || typeof parsed[fn] !== "function") return hex;
  const adjusted = parsed[fn](0.8);
  return typeof adjusted.formatHex === "function" ? adjusted.formatHex() : adjusted.toString();
}

function createScales(bounds) {
  if (!bounds) return null;
  return {
    x: d3.scaleLinear().domain([bounds.x_min, bounds.x_max]).range([PADDING, WIDTH - PADDING]),
    y: d3.scaleLinear().domain([bounds.y_min, bounds.y_max]).range([PADDING, HEIGHT - PADDING]),
  };
}

function normalizeWithScales(nodes, scales) {
  if (!nodes || !scales) return [];
  return nodes.map((n) => ({
    ...n,
    xNorm: scales.x(n.x),
    yNorm: scales.y(n.y),
  }));
}

function KnowledgeMap({
  bounds,
  coarseClusters,
  fineClusters,
  activeCoarseId,
  selectedFineCluster,
  fineClusterArticles,
  onCoarseClick,
  onFineClick,
  onBackgroundClick,
  hoveredNode,
  setHoveredNode,
}) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [zoomK, setZoomK] = useState(1);

  const scales = useMemo(() => createScales(bounds), [bounds]);
  const coarseNodes = useMemo(
    () => normalizeWithScales(coarseClusters || [], scales),
    [coarseClusters, scales]
  );
  const fineNodes = useMemo(
    () => normalizeWithScales(fineClusters || [], scales),
    [fineClusters, scales]
  );
  const articleNodes = useMemo(
    () => normalizeWithScales(fineClusterArticles || [], scales),
    [fineClusterArticles, scales]
  );

  const visibleFineNodes = useMemo(() => {
    if (activeCoarseId == null) return [];
    return fineNodes.filter((node) => node.parent_id === activeCoarseId);
  }, [fineNodes, activeCoarseId]);

  const showFineNodes = activeCoarseId != null && zoomK > 1.1 && visibleFineNodes.length > 0;
  const showArticleDots =
    selectedFineCluster &&
    fineClusterArticles &&
    fineClusterArticles.length > 0 &&
    zoomK > 1.2;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const zoom = d3
      .zoom()
      .scaleExtent([0.4, 8])
      .on("zoom", (event) => {
        setTransform(event.transform);
        setZoomK(event.transform.k);
      });

    svg.call(zoom);
  }, []);

  function handleSvgClick() {
    if (onBackgroundClick) onBackgroundClick();
  }

  return (
    <div className="knowledge-map">
      <svg
        ref={svgRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ background: "#020617", borderRadius: "24px" }}
        onClick={handleSvgClick}
      >
        <defs>
          <filter id="clusterGlow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={transform.toString()}>
          {coarseNodes.map((node) => {
            const isActive = activeCoarseId === node.id;
            const color = getTopicColor(node.label);
            const fillColor = adjustColor(color, "brighter");
            const strokeColor = adjustColor(color, "darker");
            const hideBubble = isActive && showFineNodes;

            return (
              <g
                key={node.id}
                transform={`translate(${node.xNorm}, ${node.yNorm})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCoarseClick(node.id);
                }}
                onMouseEnter={() =>
                  setHoveredNode({
                    type: "coarse",
                    ...node,
                  })
                }
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                {!hideBubble && (
                  <circle
                    r={node.size}
                    style={{
                      fill: fillColor,
                      opacity: isActive ? 1 : 0.85,
                      stroke: isActive ? "#f3f4f6" : strokeColor,
                      strokeWidth: isActive ? 2.6 : 1.6,
                      filter: "url(#clusterGlow)",
                    }}
                  />
                )}
                {hideBubble && (
                  <circle
                    r={node.size * 0.95}
                    style={{
                      fill: "none",
                      stroke: strokeColor,
                      strokeWidth: 1.4,
                      strokeDasharray: "6,6",
                      opacity: 0.9,
                    }}
                  />
                )}
                <text
                  textAnchor="middle"
                  y={-2}
                  style={{
                    fontSize: 10,
                    fill: "#e5e7eb",
                    pointerEvents: "none",
                  }}
                >
                  {node.label
                    .split(" / ")
                    .slice(0, 2)
                    .map((line, i) => (
                      <tspan key={i} x={0} dy={i === 0 ? 0 : 11}>
                        {line.slice(0, 18)}
                      </tspan>
                    ))}
                </text>
              </g>
            );
          })}

          {showFineNodes &&
            visibleFineNodes.map((node) => {
              const color = getTopicColor(node.label);
              const isSelected =
                selectedFineCluster && node.id === selectedFineCluster.fine_cluster_id;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.xNorm}, ${node.yNorm})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFineClick(node.id);
                  }}
                  onMouseEnter={() =>
                    setHoveredNode({
                      type: "fine",
                      ...node,
                    })
                  }
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={Math.max(8, node.size * 0.75)}
                    style={{
                      fill: adjustColor(color, "brighter"),
                      opacity: isSelected ? 1 : 0.92,
                      stroke: isSelected ? "#f8fafc" : adjustColor(color, "darker"),
                      strokeWidth: isSelected ? 2 : 1.2,
                      filter: "url(#clusterGlow)",
                    }}
                  />
                  <text
                    textAnchor="middle"
                    y={4}
                    style={{
                      fontSize: 9,
                      fill: "#f4f4f5",
                      pointerEvents: "none",
                    }}
                  >
                    {node.label
                      .split(" / ")
                      .slice(0, 2)
                      .map((line, i) => (
                        <tspan key={i} x={0} dy={i === 0 ? 0 : 10}>
                          {line.slice(0, 14)}
                        </tspan>
                      ))}
                  </text>
                </g>
              );
            })}

          {showArticleDots &&
            articleNodes.map((article) => (
              <circle
                key={article.id}
                cx={article.xNorm}
                cy={article.yNorm}
                r={Math.max(2.5, 4.8 / Math.sqrt(zoomK))}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() =>
                  setHoveredNode({
                    type: "article",
                    ...article,
                    fineClusterLabel: selectedFineCluster?.label,
                  })
                }
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  fill: "#f97316",
                  stroke: "#fed7aa",
                  strokeWidth: 0.6,
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
