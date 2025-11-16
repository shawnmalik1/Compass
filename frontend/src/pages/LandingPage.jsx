import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Landing from '../components/Landing.jsx';
import { fetchMap } from '../api.js';

function LandingPage() {
  const navigate = useNavigate();
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const warmMap = async () => {
      try {
        await fetchMap();
      } catch (err) {
        console.error('Failed to preload map', err);
      } finally {
        if (!cancelled) {
          setMapReady(true);
        }
      }
    };

    warmMap();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnter = () => {
    navigate('/upload');
  };

  return <Landing mapReady={mapReady} onEnter={handleEnter} />;
}

export default LandingPage;
