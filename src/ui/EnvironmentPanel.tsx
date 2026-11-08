import { useSyncExternalStore } from 'react';
import { actions, getState, subscribe } from '../store';
import { ENV_TOOLS } from '../types';
import { Slider } from './Slider';
import { confirmDialog } from './dialog';

interface EnvironmentPanelProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export function EnvironmentPanel({ open, setOpen }: EnvironmentPanelProps) {
  const state = useSyncExternalStore(subscribe, getState);
  const toolLabel = ENV_TOOLS.find((t) => t.value === state.tool)?.label ?? '';
  const cells = Object.keys(state.environment).length;

  return (
    <aside className={`panel glass ${open ? 'open' : ''}`}>
      <div className="panel-head">
        <button className="panel-handle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="grip" /> Entorno · {toolLabel}
        </button>
        <button className="panel-close" onClick={() => setOpen(false)} aria-label="Cerrar editor">✕</button>
      </div>

      <div className="panel-body">
        <section>
          <h2 className="section-title">Herramienta</h2>
          <div className="tool-grid">
            {ENV_TOOLS.map((t) => (
              <button
                key={t.value}
                className={`tool-btn ${state.tool === t.value ? 'active' : ''}`}
                onClick={() => actions.setTool(t.value)}
              >
                <span className="tool-swatch" style={{ background: t.color }} />
                {t.label}
              </button>
            ))}
          </div>
          <p className="hint-text">
            Toca o arrastra sobre la cuadrícula para pintar. Los árboles solo caben en celdas de parque.
          </p>
        </section>

        {state.tool === 'building' && (
          <section className="editor">
            <h2 className="section-title">Edificio</h2>
            <Slider
              label="Altura" unit="m" value={state.buildingHeight}
              min={3} max={60} step={1}
              onChange={(v) => actions.setBuildingHeight(v)}
            />
            <label className="field-row inline">
              <span>Color de fachada</span>
              <input
                type="color"
                value={state.buildingColor}
                onChange={(e) => actions.setBuildingColor(e.target.value)}
              />
            </label>
          </section>
        )}

        <section className="editor">
          <h2 className="section-title">Cuadrícula</h2>
          <p className="hint-text">{cells} celdas ocupadas</p>
          <button
            className="btn danger full"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Borrar entorno',
                message: 'Se borrarán todas las celdas pintadas. El estadio no se modifica.',
                confirmLabel: 'Borrar',
                danger: true,
              });
              if (ok) actions.clearEnvironment();
            }}
          >
            Borrar entorno
          </button>
        </section>
      </div>
    </aside>
  );
}
