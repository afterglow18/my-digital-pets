import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeRevenueCat } from './lib/revenuecat';

// Kick off RC initialisation immediately — before React mounts — so the SDK
// is ready (or timing out gracefully) by the time the first purchase attempt
// is made. Errors are non-fatal: the app runs fine without RC (free tier).
initializeRevenueCat().catch(console.warn);

// IndexedDB initialises lazily on first query — no explicit init needed here.
createRoot(document.getElementById('root')!).render(<App />);
