import { useState, useCallback } from 'react';
import './App.css';
import { CarreraTab } from './screens/CarreraTab';
import { HojaDeRutaTab } from './screens/HojaDeRutaTab';
import { PrepararEtapaScreen } from './screens/PrepararEtapaScreen';
import { CalibrarOdometroScreen } from './screens/CalibrarOdometroScreen';
import { CargarHojaScreen } from './screens/CargarHojaScreen';
import { AyudaScreen } from './screens/AyudaScreen';
import { CalculadoraTab } from './screens/CalculadoraTab';
import {
  INITIAL_CALCULATOR_STATE,
  stepCalculator,
  type CalculatorKey,
  type CalculatorState,
} from './logic/calculator';
import { reconcileActiveTab, type ActiveTab } from './logic/controlSystem';
import { isSetupPending } from './logic/setupStatus';
import { useStageSpeed } from './hooks/useStageSpeed';
import { useCorrectionFactor } from './hooks/useCorrectionFactor';
import { useControlSystem } from './hooks/useControlSystem';
import { useRoadbookSheet } from './hooks/useRoadbookSheet';
import { RaceProvider } from './context/RaceContext';

type Screen = 'main' | 'preparar-etapa' | 'calibrar-odometro' | 'cargar-hoja' | 'ayuda';

export function App() {
  const { assignedSpeed, saveSpeed } = useStageSpeed();
  const { correctionFactor, saveFactor } = useCorrectionFactor();
  const { controlSystem, saveControlSystem } = useControlSystem();
  const { rows, addRows, updateRow } = useRoadbookSheet();

  // activeTab is always initialized from the persisted control system, never hardcoded.
  // This is the single source of truth reconciliation: prevents CarreraTab from mounting
  // when the user has selected hoja-de-ruta, and prevents GPS from being requested.
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    reconcileActiveTab(null, controlSystem)
  );

  const [screen, setScreen] = useState<Screen>(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo === 'cal1' || demo === 'cal2' || demo === 'cal3') {
        return 'calibrar-odometro';
      }
      if (demo === 'ayuda') {
        return 'ayuda';
      }
      if (demo === 'cargar-hoja') {
        return 'cargar-hoja';
      }
    }
    return 'main';
  });

  // Tracks where CARGAR HOJA was opened from so back returns to the caller screen
  const [cargarHojaOrigin, setCargarHojaOrigin] = useState<'preparar-etapa' | 'main'>('preparar-etapa');

  // Calculator state is lifted here so it survives switching tabs and opening secondary screens
  const [calcState, setCalcState] = useState<CalculatorState>(INITIAL_CALCULATOR_STATE);

  const handleCalcKeyPress = useCallback((key: CalculatorKey) => {
    setCalcState((prev) => stepCalculator(prev, key));
  }, []);

  // Active tab label driven by control system selection
  const firstTabLabel = controlSystem === 'hoja-de-ruta' ? 'HOJA DE RUTA' : 'CARRERA';
  const firstTabValue: ActiveTab = reconcileActiveTab('', controlSystem);

  // When control system changes, always reconcile active tab.
  // CALCULADORA is preserved; first-tab is switched to match the new system.
  function handleChangeControlSystem(system: typeof controlSystem) {
    saveControlSystem(system);
    setActiveTab((prev) => reconcileActiveTab(prev, system));
  }

  return (
    <RaceProvider
      assignedSpeed={assignedSpeed}
      correctionFactor={correctionFactor}
      controlSystem={controlSystem}
    >
      <div className="app-container">
        <div className="status-bar-cover" aria-hidden="true" />
        {screen === 'calibrar-odometro' ? (
          /* ── Calibrar Odómetro secondary screen ──────────────────── */
          <CalibrarOdometroScreen
            onBackToPreparar={() => setScreen('preparar-etapa')}
            onCalibrationComplete={() => {
              setActiveTab(firstTabValue);
              setScreen('main');
            }}
            onSaveFactor={saveFactor}
          />
        ) : screen === 'cargar-hoja' ? (
          /* ── Cargar Hoja secondary screen ────────────────────────── */
          <CargarHojaScreen
            rows={rows}
            onAddRows={addRows}
            onUpdateRow={updateRow}
            onBack={() => setScreen(cargarHojaOrigin)}
          />
        ) : screen === 'ayuda' ? (
          /* ── Ayuda secondary screen ──────────────────────────────── */
          <AyudaScreen onBack={() => setScreen('main')} />
        ) : screen === 'preparar-etapa' ? (
          /* ── Preparar Etapa secondary screen ─────────────────────── */
          <PrepararEtapaScreen
            savedSpeed={assignedSpeed}
            onSave={saveSpeed}
            onBack={() => {
              // Reconcile the active tab when returning from PREPARAR ETAPA.
              // Guards against stale tab state when the control system was changed.
              setActiveTab((prev) => reconcileActiveTab(prev, controlSystem));
              setScreen('main');
            }}
            onCalibrate={() => setScreen('calibrar-odometro')}
            controlSystem={controlSystem}
            onChangeControlSystem={handleChangeControlSystem}
            roadbookRows={rows}
            onOpenCargarHoja={() => {
              setCargarHojaOrigin('preparar-etapa');
              setScreen('cargar-hoja');
            }}
          />
        ) : (
          /* ── Main tab layout ─────────────────────────────────────── */
          <>
            <header className="app-header">
              <span className="header-logo">RR</span>
              <div className="header-actions">
                <button
                  type="button"
                  className={`btn-secondary${isSetupPending(controlSystem, assignedSpeed, rows) ? ' btn-secondary--pending' : ''}`}
                  onClick={() => setScreen('preparar-etapa')}
                >
                  PREPARAR ETAPA
                </button>
                <button
                  type="button"
                  className="btn-icon-secondary"
                  aria-label="Ayuda"
                  onClick={() => setScreen('ayuda')}
                >
                  ?
                </button>
              </div>
            </header>

            <main className="app-content" role="main">
              {activeTab === 'CALCULADORA' ? (
                <CalculadoraTab state={calcState} onKeyPress={handleCalcKeyPress} />
              ) : controlSystem === 'hoja-de-ruta' ? (
                <HojaDeRutaTab
                  isVisible={activeTab === 'HOJA-DE-RUTA'}
                  rows={rows}
                  onOpenCargarHoja={() => {
                    setCargarHojaOrigin('main');
                    setScreen('cargar-hoja');
                  }}
                />
              ) : (
                <CarreraTab isVisible={activeTab === 'CARRERA'} assignedSpeed={assignedSpeed} />
              )}
            </main>

            <nav className="app-tab-bar" aria-label="Navegación principal">
              <div className="tab-bar-inner">
                <button
                  type="button"
                  className={`tab-button ${activeTab === firstTabValue ? 'active' : ''}`}
                  onClick={() => setActiveTab(firstTabValue)}
                  aria-pressed={activeTab === firstTabValue}
                >
                  {firstTabLabel}
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
