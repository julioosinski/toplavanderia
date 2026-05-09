import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Auto-reload on stale dynamic import (after deploy, cached chunk hashes 404)
const handleChunkError = (message: string) => {
  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes("error loading dynamically imported module")
  ) {
    const key = 'lov-chunk-reload-ts';
    const last = Number(sessionStorage.getItem(key) || '0');
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  }
};

window.addEventListener('error', (e) => handleChunkError(e.message || ''));
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason || '');
  handleChunkError(msg);
});

createRoot(document.getElementById("root")!).render(<App />);
