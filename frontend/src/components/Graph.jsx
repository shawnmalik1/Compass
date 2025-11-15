import { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function deriveTopicLabel(article = {}) {
  return (
    article.fine_cluster_label ||
    article.fineClusterLabel ||
    article.coarse_cluster_label ||
    article.coarseClusterLabel ||
    article.parent_coarse_label ||
    article.parentLabel ||
    article.section_name ||
    article.section ||
    (Array.isArray(article.keywords) ? article.keywords[0] : null) ||
    'Miscellaneous'
  );
}

function buildGraphData(articles, documentNode) {
  const nodes = [];
  const links = [];
  const linkSet = new Set();

  const addLink = (source, target, type, weight = 0.05) => {
    if (!source || !target || source === target) return;
    const key = [source, target].sort().join('::');
    if (linkSet.has(key)) return;
    linkSet.add(key);
    links.push({ source, target, type, weight });
  };

  const articleNodes = (articles || []).map((article) => {
    const label = deriveTopicLabel(article);
    return {
      id: article.id,
      type: 'article',
      headline: article.headline,
      section: label,
      score: article.score,
      data: article,
    };
  });

  const sectionGroups = new Map();
  articleNodes.forEach((node) => {
    if (!sectionGroups.has(node.section)) {
      sectionGroups.set(node.section, []);
    }
    sectionGroups.get(node.section).push(node);
  });

  const sectionNodes = Array.from(sectionGroups.entries())
    .map(([section, articlesForSection]) => ({
      id: `section-${section}`,
      type: 'section',
      label: `${section} · ${articlesForSection.length}`,
      rawLabel: section,
      size: articlesForSection.length,
    }))
    .filter((sectionNode) => sectionNode.size >= 3);

  nodes.push(...sectionNodes, ...articleNodes);

  sectionNodes.forEach((sectionNode) => {
    const articlesForSection = sectionGroups.get(sectionNode.rawLabel) || [];
    articlesForSection.forEach((article) => {
      addLink(sectionNode.id, article.id, 'section-hub', 0.08);
    });
  });

  if (documentNode) {
    nodes.unshift(documentNode);
    const linkedArticles = articleNodes.slice(0, 12);
    linkedArticles.forEach((article) => {
      addLink(
        documentNode.id,
        article.id,
        'doc-article',
        typeof article.score === 'number' ? article.score : 0.15,
      );
    });
  }

  // Light mesh to avoid stringy visualization.
  const nodeCount = articleNodes.length;
  if (nodeCount > 6) {
    const neighborStep = Math.max(6, Math.floor(nodeCount / 4));
    articleNodes.forEach((node, index) => {
      if (index % 2 !== 0) return;
      const neighborIndex = (index + neighborStep) % nodeCount;
      addLink(node.id, articleNodes[neighborIndex].id, 'mesh', 0.015);
    });
  }

  return { nodes, links };
}

function Graph({
  articles = [],
  documentNode,
  onNodeClick,
  selectedNodeId,
}) {
  const graphData = useMemo(
    () => buildGraphData(articles, documentNode),
    [articles, documentNode],
  );
  const drawNode = (node, ctx) => {
    const isDocument = node.type === 'document';
    const isSection = node.type === 'section';
    const radius = isDocument ? 9 : isSection ? Math.min(24, 10 + (node.size || 0) / 4) : 5;
    const isSelected = selectedNodeId && node.id === selectedNodeId;

    ctx.beginPath();
    if (isDocument) {
      ctx.fillStyle = '#f97316';
    } else if (isSection) {
      ctx.fillStyle = '#475569';
    } else {
      ctx.fillStyle = '#38bdf8';
    }
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fill();

    if (isSection) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label.slice(0, 14), node.x, node.y);
    }

    if (isSelected) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const paintPointer = (node, color, ctx) => {
    const isDocument = node.type === 'document';
    const isSection = node.type === 'section';
    const radius = isDocument ? 9 : isSection ? 18 : 5;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI, false);
    ctx.fill();
  };

  return (
    <ForceGraph2D
      graphData={graphData}
      backgroundColor="#020617"
      nodeLabel={(node) => {
        if (node.type === 'document') return 'Your Document';
        if (node.type === 'section') return node.label;
        return node.headline;
      }}
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={paintPointer}
      onNodeClick={(node) => onNodeClick?.(node)}
      linkColor={(link) => {
        if (link.type === 'doc-article') return 'rgba(248,113,113,0.6)';
        if (link.type === 'mesh') return 'rgba(96,165,250,0.18)';
        if (link.type === 'section-hub') return 'rgba(71,85,105,0.35)';
        return 'rgba(148,163,184,0.3)';
      }}
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
