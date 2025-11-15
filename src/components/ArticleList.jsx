import React from "react";

function ArticleList({ title, articles }) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="article-list">
      <h3>{title}</h3>
      <ul>
        {articles.map((a) => (
          <li key={a.id}>
            <div className="headline">{a.headline}</div>
            <div className="meta">
              {a.section || "Unknown section"} • {a.pub_date || "Unknown date"}
            </div>
            {a.abstract && (
              <div className="abstract">
                {a.abstract.slice(0, 200)}
                {a.abstract.length > 200 ? "…" : ""}
              </div>
            )}
            {a.url && (
              <a href={a.url} target="_blank" rel="noreferrer">
                Open article
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ArticleList;
