import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card.jsx';
import { CompassContext } from '../App.jsx';

function InsightsPage() {
  const navigate = useNavigate();
  const { analysis, documentText, nearestArticles } = useContext(CompassContext);

  const hasAnalysis = Boolean(analysis);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Insights</h1>
        <p className="text-slate-400">
          Review Claude's summary and citation set tied directly to the NYT neighbors surfaced in
          the graph view.
        </p>
      </header>

      {!documentText && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Upload a document to unlock the graph and analysis workflow.
        </p>
      )}

      {!hasAnalysis && documentText && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
          No analysis has been generated yet. Visit the graph tab and click "Generate Insights" to
          request Claude's summary.
          <button
            type="button"
            onClick={() => navigate('/graph')}
            className="ml-3 rounded-md border border-compass-primary/60 px-3 py-1 text-xs font-semibold text-compass-primary hover:bg-compass-primary/10"
          >
            Go to Graph
          </button>
        </div>
      )}

      {hasAnalysis && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Document recap">
            <p className="text-sm text-slate-300">
              {analysis.summary || 'Summary unavailable.'}
            </p>
            <div className="mt-4 text-xs text-slate-500">
              <p>Characters processed: {documentText?.length || 0}</p>
              <p>Neighbors considered: {nearestArticles?.length || 0}</p>
            </div>
          </Card>

          <Card title="Key insights">
            <p className="whitespace-pre-line text-sm text-slate-300">
              {analysis.insights || 'Insights unavailable.'}
            </p>
          </Card>

          <Card title="Citations">
            {analysis.citations?.length ? (
              <ul className="space-y-3 text-sm text-slate-200">
                {analysis.citations.map((citation) => (
                  <li key={citation.id} className="rounded-lg border border-slate-800 p-3">
                    <a
                      href={citation.web_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-compass-accent hover:underline"
                    >
                      {citation.headline}
                    </a>
                    <p className="text-xs text-slate-500">{citation.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Claude did not surface any citations.</p>
            )}
          </Card>

          <Card title="Opposing / complementary views">
            <p className="whitespace-pre-line text-sm text-slate-300">
              {analysis.opposingViews || 'Opposing viewpoints unavailable.'}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

export default InsightsPage;
