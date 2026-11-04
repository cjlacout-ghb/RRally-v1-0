import './AyudaScreen.css';

interface AyudaScreenProps {
  onBack: () => void;
}

export function AyudaScreen({ onBack }: AyudaScreenProps) {
  return (
    <div className="secondary-screen">
      <header className="secondary-header">
        <button
          type="button"
          className="btn-icon-secondary"
          onClick={onBack}
          aria-label="Volver"
        >
          ‹
        </button>
        <h2 className="secondary-title">AYUDA</h2>
      </header>

      <div className="secondary-content">
        <div className="card ayuda-steps-card">
          <div className="ayuda-step">
            <span className="ayuda-step-num brass">1</span>
            <span>Calibrá el odómetro en la zona de control de la organización.</span>
          </div>
          <div className="ayuda-step">
            <span className="ayuda-step-num brass">2</span>
            <span>Cargá la velocidad media de la etapa.</span>
          </div>
          <div className="ayuda-step">
            <span className="ayuda-step-num brass">3</span>
            <span>Sincronizá con la hora oficial e iniciá el cronómetro.</span>
          </div>
          <div className="ayuda-step">
            <span className="ayuda-step-num brass">4</span>
            <span>Mantené la diferencia lo más cerca de cero.</span>
          </div>
        </div>

        <div className="card">
          <div className="label-md on-surface-variant">ADVERTENCIAS</div>
          <ul className="ayuda-warnings body-md on-surface-variant">
            <li>El GPS del teléfono no es un odómetro de rueda.</li>
            <li>Mantené la app abierta, con la pantalla encendida y el teléfono cargando.</li>
            <li>Probala antes de la carrera.</li>
            <li>Es para el copiloto: el piloto no debe usarla mientras maneja.</li>
            <li>Si la app se cierra, el cronómetro sigue, pero la distancia se reinicia.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
