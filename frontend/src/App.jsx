import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { createContext, useMemo, useState } from 'react';
import UploadPage from './pages/UploadPage.jsx';
import GraphPage from './pages/GraphPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import Sidebar from './components/Sidebar.jsx';

export const CompassContext = createContext(null);

function App() {
  const [documentText, setDocumentText] = useState(null);
  const [documentEmbedding, setDocumentEmbedding] = useState(null);
  const [nearestArticles, setNearestArticles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [mapUploadResult, setMapUploadResult] = useState(null);

  const contextValue = useMemo(
    () => ({
      documentText,
      setDocumentText,
      documentEmbedding,
      setDocumentEmbedding,
      nearestArticles,
      setNearestArticles,
      analysis,
      setAnalysis,
      mapUploadResult,
      setMapUploadResult,
    }),
    [
      documentText,
      documentEmbedding,
      nearestArticles,
      analysis,
      mapUploadResult,
    ],
  );

  return (
    <CompassContext.Provider value={contextValue}>
      <BrowserRouter>
        <div className="flex h-screen bg-slate-950 text-slate-50">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-8 py-6">
            <Routes>
              <Route path="/" element={<Navigate to="/upload" replace />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/insights" element={<InsightsPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </CompassContext.Provider>
  );
}

export default App;
