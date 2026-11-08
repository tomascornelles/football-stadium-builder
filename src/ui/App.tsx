import { useRef, useSyncExternalStore } from 'react';
import { StadiumView } from '../three/StadiumView';
import { actions, getState, subscribe } from '../store';
import { APP_VERSION } from '../config';
import { EditorPanel } from './EditorPanel';
import { DialogHost } from './DialogHost';
import { exportFlow, importFlow, libraryFlow, resetFlow, saveFlow } from './flows';

export function App() {
  const state = useSyncExternalStore(subscribe, getState);
  const fileRef = useRef<HTMLInputElement>(null);
  const view = (((state.rotationSteps % 4) + 4) % 4) * 90;

  return (
    <div className="app">
      <header className="toolbar glass">
        <div className="brand">
          <span className="logo">⚽</span>
          <div>
            <strong>Football Stadium Builder</strong>
            <small>v{APP_VERSION}</small>
          </div>
        </div>
        <div className="tools">
          <button className="btn" onClick={() => saveFlow()} title="Guardar en este dispositivo">Guardar</button>
          <button className="btn" onClick={() => libraryFlow()} title="Abrir estadio guardado">Cargar</button>
          <button className="btn" onClick={() => exportFlow()} title="Descargar archivo .json">Exportar</button>
          <button className="btn" onClick={() => fileRef.current?.click()} title="Importar archivo .json">Importar</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) importFlow(file);
            }}
          />
          <span className="view-chip">Vista {view}°</span>
          <button className="btn" onClick={() => actions.rotate()} title="Girar 90°">↻ 90°</button>
          <button className="btn ghost" onClick={() => resetFlow()}>Reiniciar</button>
        </div>
      </header>

      <main className="stage glass">
        <StadiumView />
        <p className="stage-hint">Toca un módulo o una grada para seleccionarlo</p>
      </main>

      <EditorPanel />
      <DialogHost />
    </div>
  );
}
