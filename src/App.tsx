import { useState } from 'react';
import './App.css';
import { CarreraTab } from './screens/CarreraTab';
import { PrepararEtapaScreen } from './screens/PrepararEtapaScreen';
import { CalibrarOdometroScreen } from './screens/CalibrarOdometroScreen';
import { useStageSpeed } from './hooks/useStageSpeed';
import { useCorrectionFactor } from './hooks/useCorrectionFactor';
import { RaceProvider } from './context/RaceContext';

type Tab = 'CARRERA' | 'CALCULADORA';
type Screen = 'main' | 'preparar-etapa' | 'calibrar-odometro';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('CARRERA');
  const [screen, setScreen] = useState<Screen>(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo === 'cal1' || demo === 'cal2' || demo === 'cal3') {
        return 'calibrar-odometro';
      }
    }
    return 'main';
  });

  const { assignedSpeed, saveSpeed } = useStageSpeed();
  const { correctionFactor, saveFactor } = useCorrectionFactor();

  return (
    <RaceProvider assignedSpeed={assignedSpeed} correctionFactor={correctionFactor}>
      <div className="app-container">
        <div className="status-bar-cover" aria-hidden="true" />
        {screen === 'calibrar-odometro' ? (
          /* ── Calibrar Odómetro secondary screen ──────────────── */
          <CalibrarOdometroScreen
            onBackToPreparar={() => setScreen('preparar-etapa')}
            onCalibrationComplete={() => {
              setActiveTab('CARRERA');
              setScreen('main');
            }}
            onSaveFactor={saveFactor}
          />
        ) : screen === 'preparar-etapa' ? (
          /* ── Preparar Etapa secondary screen ─────────────────── */
          <PrepararEtapaScreen
            savedSpeed={assignedSpeed}
            onSave={saveSpeed}
            onBack={() => setScreen('main')}
            onCalibrate={() => setScreen('calibrar-odometro')}
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
