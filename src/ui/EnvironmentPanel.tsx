import { useSyncExternalStore } from 'react';
import { actions, getState, subscribe } from '../store';
import { BUILDING_OPTIONS, ENV_TOOLS } from '../types';
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
            Todo el entorno es parque por defecto. Borrar devuelve la celda a parque.
            Los árboles solo caben en parques.
          </p>
        </section>

        {state.tool === 'building' && (
          <section className="editor">
            <h2 className="section-title">Tipo de edificio</h2>
            <div className="segmented kind-segmented" role="tablist">
              {BUILDING_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  role="tab"
                  aria-selected={state.buildingKind === o.value}
                  className={state.buildingKind === o.value ? 'active' : ''}
                  onClick={() => actions.setBuildingKind(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
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
          <p className="hint-text">{cells} celdas modificadas</p>
          <button
            className="btn danger full"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Borrar entorno',
                message: 'Todas las celdas vuelven a ser parque. El estadio no se modifica.',
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
