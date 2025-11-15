import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card.jsx';
import FileInput from '../components/FileInput.jsx';
import { uploadFile } from '../api/upload.js';
import { embedText } from '../api/embed.js';
import { getNearest } from '../api/nearest.js';
import { CompassContext } from '../App.jsx';

function PipelineStep({ label, active, done }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm transition ${
        active
          ? 'border-compass-accent text-compass-accent'
          : done
            ? 'border-emerald-500 text-emerald-400'
            : 'border-slate-700 text-slate-400'
      }`}
    >
      {label}
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
  } = useContext(CompassContext);
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setStatus('Uploading');
    setAnalysis(null);

    try {
      const { text } = await uploadFile(file);
      const cleanedText = (text || '').trim();
      if (!cleanedText) {
        throw new Error('No text extracted from file.');
      }
      setDocumentText(cleanedText);
      setPreview(cleanedText);

      setStatus('Embedding');
      const { embedding } = await embedText(cleanedText);
      setDocumentEmbedding(embedding);

      setStatus('Finding Nearest');
      const nearestArticles = await getNearest(embedding, 20);
      setNearestArticles(nearestArticles);
      setStatus('Complete');
      navigate('/graph');
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setStatus('Error');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Upload Research</h1>
      <p className="text-slate-400">
        Send a PDF or text file to the backend. The document is embedded, mapped
        to the nearest NYT reporting, and summarized with citations.
      </p>

      <Card title="Upload document">
        <FileInput onSelect={handleFile} />
        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
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
