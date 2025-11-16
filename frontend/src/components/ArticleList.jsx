import React from 'react';

function truncate(text = '', limit = 200) {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...`;
}

function ArticleList({ title, articles, onCite, citationState }) {
  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <div className="article-list">
      <h3>{title}</h3>
      <div className="article-list-body">
        <ul>
          {articles.map((article) => {
            const body = article.abstract || article.snippet || '';
            const section =
              article.section_name || article.section || 'Unknown section';
            const url = article.web_url || article.url;
            const isActive = citationState?.articleId === article.id;
            const isLoading = Boolean(isActive && citationState?.loading);
            const hasCitation = Boolean(isActive && citationState?.text);
            const hasError = Boolean(isActive && citationState?.error);

            return (
              <li key={article.id}>
                <div className="headline">{article.headline}</div>
                <div className="meta">
                  {section} - {article.pub_date || 'Unknown date'}
                </div>
                {body && <div className="abstract">{truncate(body)}</div>}
                <div className="article-actions">
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer">
                      Open article
                    </a>
                  )}
                  {onCite && (
                    <button
                      type="button"
                      className="cite-button"
                      onClick={() => onCite(article)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Citing...' : 'Cite'}
                    </button>
                  )}
                </div>
                {isActive && (
                  <div className="citation-block">
                    {hasCitation && <span>{citationState.text}</span>}
                    {hasError && (
                      <span className="citation-error">
                        {citationState.error}
                      </span>
                    )}
                    {!hasCitation && !hasError && isLoading && (
                      <span>Generating citation...</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default ArticleList;
