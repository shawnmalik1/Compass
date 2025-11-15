import React from 'react';

function truncate(text = '', limit = 200) {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...`;
}

function ArticleList({ title, articles }) {
  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <div className="article-list">
      <h3>{title}</h3>
      <ul>
        {articles.map((article) => {
          const body = article.abstract || article.snippet || '';
          const section =
            article.section_name || article.section || 'Unknown section';
          const url = article.web_url || article.url;

          return (
            <li key={article.id}>
              <div className="headline">{article.headline}</div>
              <div className="meta">
                {section} - {article.pub_date || 'Unknown date'}
              </div>
              {body && <div className="abstract">{truncate(body)}</div>}
              {url && (
                <a href={url} target="_blank" rel="noreferrer">
                  Open article
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ArticleList;
