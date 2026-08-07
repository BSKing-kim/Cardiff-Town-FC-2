// Silence harmless Firestore future update time warning logs caused by minor container clock skew
const filterWarningGlobal = (args: any[], fallback: (...a: any[]) => void) => {
  const msg = args.map(arg => {
    try {
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    } catch {
      return String(arg);
    }
  }).join(" ");
  if (msg.includes("Detected an update time that is in the future")) {
    return;
  }
  fallback(...args);
};

const originalWarnGlobal = console.warn;
const originalErrorGlobal = console.error;
console.warn = (...args: any[]) => filterWarningGlobal(args, originalWarnGlobal);
console.error = (...args: any[]) => filterWarningGlobal(args, originalErrorGlobal);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
