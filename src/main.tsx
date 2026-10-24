import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/space-mono/700.css';
import '@fontsource/chivo/400.css';
import '@fontsource/chivo/700.css';
import './tokens.css';
import App from './App';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
