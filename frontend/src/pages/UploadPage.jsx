import { useContext, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card.jsx';
import FileInput from '../components/FileInput.jsx';
import { uploadFile } from '../api/upload.js';
import { uploadText as mapUploadText } from '../api.js';
import { CompassContext } from '../App.jsx';
import { normalizeArticles } from '../utils/articles.js';

function PipelineStep({ label, active, done }) {
  const state = active ? 'active' : done ? 'done' : 'pending';
  const baseClasses =
    'rounded-lg border px-4 py-3 text-sm transition relative overflow-hidden';
  const colorMap = {
    pending: 'border-slate-700 text-slate-400',
    active: 'border-compass-accent text-compass-accent',
    done: 'border-emerald-500 text-emerald-400',
  };

  return (
    <div className={`${baseClasses} ${colorMap[state]}`}>
      {(active || done) && (
        <div className="absolute inset-0 overflow-hidden rounded-lg">
          <div
            className={`h-full ${
              state === 'done'
                ? 'w-full bg-emerald-500/40'
                : 'w-2/3 bg-compass-accent/30 animation-pipeline'
            }`}
          />
        </div>
      )}
      <span className="relative">{label}</span>
    </div>
  );
}

function UploadPage() {
  const navigate = useNavigate();
  const {
    setDocumentText,
    setDocumentEmbedding,
    setNearestArticles,
    setAnalysis,
    setMapUploadResult,
  } = useContext(CompassContext);
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const navigateDelayRef = useRef(null);
  const [datasetLinked, setDatasetLinked] = useState(null);
  const [scrapeRunning, setScrapeRunning] = useState(false);
  const [scrapeSeconds, setScrapeSeconds] = useState(0);
  const scrapeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (navigateDelayRef.current) {
        clearTimeout(navigateDelayRef.current);
      }
      if (scrapeTimerRef.current) {
        clearInterval(scrapeTimerRef.current);
      }
    };
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setStatus('Uploading');
    setAnalysis(null);
    if (navigateDelayRef.current) {
      clearTimeout(navigateDelayRef.current);
    }

    try {
      const { text } = await uploadFile(file);
      const cleanedText = (text || '').trim();
      if (!cleanedText) {
        throw new Error('No text extracted from file.');
      }
      setDocumentText(cleanedText);
      setPreview(cleanedText);

      setStatus('Embedding');
      const mapResult = await mapUploadText(cleanedText);

      const normalizedNeighbors = normalizeArticles(mapResult.neighbors || []);
      setDocumentEmbedding(null);
      setStatus('Finding Nearest');
      setNearestArticles(normalizedNeighbors);
      setMapUploadResult({
        ...mapResult,
        neighbors: normalizedNeighbors,
        source: 'document-upload',
      });
      setStatus('Complete');
      navigateDelayRef.current = setTimeout(() => {
        navigate('/graph');
      }, 900);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setStatus('Error');
      if (navigateDelayRef.current) {
        clearTimeout(navigateDelayRef.current);
      }
    }
  };

  const handleLinkDataset = () => {
    setDatasetLinked('New York Times Topics (Sample)');
  };

  const handleToggleScrape = () => {
    if (scrapeRunning) {
      setScrapeRunning(false);
      setScrapeSeconds(0);
      if (scrapeTimerRef.current) {
        clearInterval(scrapeTimerRef.current);
      }
      return;
    }
    setScrapeRunning(true);
    scrapeTimerRef.current = setInterval(() => {
      setScrapeSeconds((prev) => prev + 1);
    }, 1000);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Upload Research</h1>
      <p className="text-slate-400">
        Send a PDF or text file to the backend. The document is embedded, mapped
        to the nearest NYT reporting, and summarized with citations.
      </p>

      <Card title="Upload document">
        <FileInput onSelect={handleFile} />
        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
      </Card>

      <Card title="Datasets & enrichment">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  Link a dataset
                </p>
                <p className="text-xs text-slate-400">
                  Choose your source for project.
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(datasetLinked)}
                onClick={handleLinkDataset}
                className="rounded-full border border-compass-primary px-4 py-2 text-xs font-semibold text-compass-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {datasetLinked ? 'Linked' : 'Link NYT dataset'}
              </button>
            </div>
            {datasetLinked && (
              <p className="text-xs text-emerald-400">
                ✓ Connected to {datasetLinked}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  Scrape Google
                </p>
                <p className="text-xs text-slate-400">
                  Scraper runs indefinitely until cancelled.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleScrape}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  scrapeRunning
                    ? 'border border-rose-500 text-rose-400'
                    : 'border border-slate-600 text-slate-200 hover:border-compass-primary hover:text-compass-primary'
                }`}
              >
                {scrapeRunning ? 'Click again to cancel' : 'Start scrape'}
              </button>
            </div>
            {scrapeRunning && (
              <p className="text-xs text-rose-300">
                Scraping Google... {scrapeSeconds}s elapsed
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Pipeline progress">
        <div className="grid gap-3 md:grid-cols-4">
          <PipelineStep
            label="Upload"
            active={status === 'Uploading'}
            done={['Embedding', 'Finding Nearest', 'Complete'].includes(status)}
          />
          <PipelineStep
            label="Embedding"
            active={status === 'Embedding'}
            done={['Finding Nearest', 'Complete'].includes(status)}
          />
          <PipelineStep
            label="Nearest Neighbors"
            active={status === 'Finding Nearest'}
            done={status === 'Complete'}
          />
          <PipelineStep label="Insights" active={status === 'Complete'} done={status === 'Complete'} />
        </div>
        <p className="mt-4 text-sm text-slate-400">Status: {status}</p>
      </Card>

      {preview && (
        <Card title="Document preview">
          <p className="max-h-48 overflow-y-auto text-sm text-slate-300">
            {preview}
          </p>
        </Card>
      )}
    </div>
  );
}

export default UploadPage;
