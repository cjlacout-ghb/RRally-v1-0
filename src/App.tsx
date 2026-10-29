import { useState } from 'react';
import './App.css';
import { CarreraTab } from './screens/CarreraTab';
import { PrepararEtapaScreen } from './screens/PrepararEtapaScreen';
import { useStageSpeed } from './hooks/useStageSpeed';
import { RaceProvider } from './context/RaceContext';

type Tab = 'CARRERA' | 'CALCULADORA';
type Screen = 'main' | 'preparar-etapa';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('CARRERA');
  const [screen, setScreen] = useState<Screen>('main');

  const { assignedSpeed, saveSpeed } = useStageSpeed();

  return (
    <RaceProvider assignedSpeed={assignedSpeed}>
      <div className="app-container">
        <div className="status-bar-cover" aria-hidden="true" />
        {screen === 'preparar-etapa' ? (
          /* ── Preparar Etapa secondary screen ─────────────────── */
          <PrepararEtapaScreen
            savedSpeed={assignedSpeed}
            onSave={saveSpeed}
            onBack={() => setScreen('main')}
          />
        ) : (
          /* ── Main tab layout ─────────────────────────────────── */
          <>
            <header className="app-header">
              <span className="header-logo">RR</span>
              <div className="header-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setScreen('preparar-etapa')}
                >
                  PREPARAR ETAPA
                </button>
                {/* Help screen — Phase 6. Button is rendered but does nothing yet. */}
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
                <CarreraTab isVisible={activeTab === 'CARRERA'} assignedSpeed={assignedSpeed} />
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
          </>
        )}
      </div>
    </RaceProvider>
  );
}

export default App;
