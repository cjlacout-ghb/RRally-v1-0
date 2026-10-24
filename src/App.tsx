import { useState } from 'react';
import './App.css';

type Tab = 'CARRERA' | 'CALCULADORA';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('CARRERA');

  return (
    <div className="app-container">
      <header className="app-header">
        <span className="header-logo">RR</span>
        <div className="header-actions">
          <button
            type="button"
            className="btn-icon-secondary"
            aria-label="Preparar etapa"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
          </button>
          <button
            type="button"
            className="btn-icon-secondary"
            aria-label="Ayuda"
          >
            ?
          </button>
        </div>
      </header>

      <main className="app-content" role="main">
        {activeTab === 'CARRERA' ? (
          <div data-testid="carrera-content" />
        ) : (
          <div data-testid="calculadora-content" />
        )}
      </main>

      <nav className="app-tab-bar" aria-label="Navegación principal">
        <div className="tab-bar-inner">
          <button
            type="button"
            className={`tab-button ${activeTab === 'CARRERA' ? 'active' : ''}`}
            onClick={() => setActiveTab('CARRERA')}
            aria-pressed={activeTab === 'CARRERA'}
          >
            CARRERA
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'CALCULADORA' ? 'active' : ''}`}
            onClick={() => setActiveTab('CALCULADORA')}
            aria-pressed={activeTab === 'CALCULADORA'}
          >
            CALCULADORA
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
