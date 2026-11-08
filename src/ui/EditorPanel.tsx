import { useSyncExternalStore } from 'react';
import { actions, getState, subscribe } from '../store';
import { MODULE_NAMES, ModuleId } from '../types';
import { StandEditor } from './StandEditor';
import { ExteriorEditor } from './ExteriorEditor';

interface EditorPanelProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export function EditorPanel({ open, setOpen }: EditorPanelProps) {
  const state = useSyncExternalStore(subscribe, getState);

  const stands = state.stands
    .filter((s) => s.moduleId === state.selectedModule)
    .sort((a, b) => a.order - b.order);
  const selected = state.stands.find((s) => s.id === state.selectedStandId) ?? null;
  // Nivel real (1 = la más baja) y orden de lista: las más altas arriba
  const listed = stands.map((s, i) => ({ s, level: i + 1 })).reverse();

  return (
    <aside className={`panel glass ${open ? 'open' : ''}`}>
      <div className="panel-head">
        <button className="panel-handle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="grip" /> Editor · {MODULE_NAMES[state.selectedModule]}
        </button>
        <button className="panel-close" onClick={() => setOpen(false)} aria-label="Cerrar editor">✕</button>
      </div>

      <div className="panel-body">
        <p className="current-module">
          Seleccionado: <strong>{MODULE_NAMES[state.selectedModule]}</strong>
        </p>

        <section>
          <div className="row-between">
            <h2 className="section-title">Gradas ({stands.length})</h2>
            <button className="btn primary small" onClick={() => actions.addStand()}>
              + Añadir grada
            </button>
          </div>
          {stands.length === 0 ? (
            <p className="hint-text">Este módulo no tiene gradas todavía.</p>
          ) : (
            <ul className="stand-list">
              {listed.map(({ s, level }) => (
                <li key={s.id}>
                  <button
                    className={`stand-item ${state.selectedStandId === s.id ? 'active' : ''}`}
                    onClick={() => actions.selectStand(s.id)}
                  >
                    <span className="swatch" style={{ background: s.color }} />
                    <span>Nivel {level}</span>
                    <span className="meta">{s.height} m · {s.tilt}°</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <StandEditor stand={selected} />
        ) : (
          <p className="hint-text">Selecciona una grada en el estadio o en la lista para editarla.</p>
        )}

        <ExteriorEditor moduleId={state.selectedModule} ext={state.exteriors[state.selectedModule]} />
      </div>
    </aside>
  );
}
