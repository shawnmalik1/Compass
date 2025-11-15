import { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

function buildGraphData(articles, documentNode) {
  const nodes = [];
  const links = [];

  const articleNodes = (articles || []).map((article) => ({
    id: article.id,
    type: 'article',
    headline: article.headline,
    section: article.section_name || article.section,
    score: article.score,
    data: article,
  }));

  nodes.push(...articleNodes);

  if (documentNode) {
    nodes.unshift(documentNode);
    const linkedArticles = articleNodes.slice(0, 10);
    linkedArticles.forEach((article) => {
      links.push({
        source: documentNode.id,
        target: article.id,
        type: 'doc-article',
        weight: typeof article.score === 'number' ? article.score : 0.1,
      });
    });
  }

  // Simple cluster linking by section for extra structure.
  const sectionGroups = new Map();
  articleNodes.forEach((node) => {
    const section = node.section || 'unknown';
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
    }
    sectionGroups.get(section).push(node.id);
  });

  for (const ids of sectionGroups.values()) {
    for (let i = 0; i < ids.length - 1; i += 1) {
      links.push({
        source: ids[i],
        target: ids[i + 1],
        type: 'section',
        weight: 0.05,
      });
    }
  }

  return { nodes, links };
}

function Graph({ articles = [], documentNode, onNodeClick, selectedNodeId }) {
  const graphData = useMemo(
    () => buildGraphData(articles, documentNode),
    [articles, documentNode],
  );
  const drawNode = (node, ctx) => {
    const isDocument = node.type === 'document';
    const radius = isDocument ? 9 : 5;
    const isSelected = selectedNodeId && node.id === selectedNodeId;

    ctx.beginPath();
    ctx.fillStyle = isDocument ? '#f97316' : '#38bdf8';
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

  };

  const paintPointer = (node, color, ctx) => {
    const isDocument = node.type === 'document';
    const radius = isDocument ? 9 : 5;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI, false);
    ctx.fill();
  };

  return (
    <ForceGraph2D
      graphData={graphData}
      backgroundColor="#020617"
      nodeLabel={(node) =>
        node.type === 'document' ? 'Your Document' : node.headline
      }
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={paintPointer}
      onNodeClick={(node) => onNodeClick?.(node)}
      linkColor={(link) =>
        link.type === 'doc-article' ? 'rgba(248,113,113,0.6)' : 'rgba(148,163,184,0.3)'
      }
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={(link) =>
        link.type === 'doc-article' ? 2 : 0
      }
      linkDirectionalParticleSpeed={(link) =>
        link.type === 'doc-article'
          ? Math.max(0.002, link.weight || 0.002)
          : 0.001
      }
      cooldownTicks={120}
    />
  );
}

export default Graph;
