// PS2WEB(Sprint 1): App shell = FPS stats + persistent library over OPFS.
// Overrides upstream App.tsx (single file input) with a product-grade library.
import './App.css';
import { useEffect, useState } from 'react';
import { PlayModule } from './PlayModule';
import { useAppSelector } from './Actions';
import { Library } from './ps2web_library';

function Stats() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const frames = PlayModule ? PlayModule.getFrames() : 0;
        if (PlayModule) PlayModule.clearStats();
        setFps(frames);
      } catch { /* module not ready */ }
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="ps2-fps" data-testid="ps2-fps">{fps} f/s</span>;
}

function App() {
  const state = useAppSelector((s) => s.play);
  const ready = state.value === 'initialized' || state.value === 'loaded';
  return (
    <div className="ps2-app">
      <div className="ps2-header">
        <span className="ps2-brand">ps2web</span>
        <Stats />
        <span className="ps2-version">{`v${process.env.REACT_APP_VERSION || 'dev'}`}</span>
      </div>
      <Library ready={ready} />
    </div>
  );
}

export default App;
