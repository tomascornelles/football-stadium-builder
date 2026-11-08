import { useEffect, useState, useSyncExternalStore } from 'react';
import { actions, getState, subscribe } from '../store';
import { MODULE_IDS, MODULE_NAMES, ModuleId } from '../types';
import { StandEditor } from './StandEditor';
import { ExteriorEditor } from './ExteriorEditor';

const SHORT_NAMES: Record<ModuleId, string> = {
  nw: 'Esq. NO', north: 'Fondo N', ne: 'Esq. NE',
  west: 'Lat. izq.', east: 'Lat. der.',
  sw: 'Esq. SO', south: 'Fondo S', se: 'Esq. SE',
};

const GRID: (ModuleId | 'field')[][] = [
  ['nw', 'north', 'ne'],
  ['west', 'field', 'east'],
  ['sw', 'south', 'se'],
];

export function EditorPanel() {
  const state = useSyncExternalStore(subscribe, getState);
  const [open, setOpen] = useState(false);

  // En móvil, abrir el editor automáticamente al seleccionar una grada
  useEffect(() => {
    if (state.selectedStandId) setOpen(true);
  }, [state.selectedStandId]);

  const stands = state.stands
    .filter((s) => s.moduleId === state.selectedModule)
    .sort((a, b) => a.order - b.order);
  const selected = state.stands.find((s) => s.id === state.selectedStandId) ?? null;
  const countOf = (id: ModuleId) => state.stands.filter((s) => s.moduleId === id).length;

  return (
    <aside className={`panel glass ${open ? 'open' : ''}`}>
      <button className="panel-handle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="grip" /> Editor · {MODULE_NAMES[state.selectedModule]}
      </button>

      <div className="panel-body">
        <section>
          <h2 className="section-title">Módulos</h2>
          <div className="module-map">
            {GRID.flat().map((cell, i) =>
              cell === 'field' ? (
                <div key={i} className="module-cell field" aria-hidden>⚽</div>
              ) : (
                <button
                  key={cell}
                  className={`module-cell ${state.selectedModule === cell ? 'active' : ''}`}
                  onClick={() => actions.selectModule(cell)}
                >
                  <span>{SHORT_NAMES[cell]}</span>
                  <span className="count">{countOf(cell)} gradas</span>
                </button>
              ),
            )}
          </div>
          <p className="current-module">
            Seleccionado: <strong>{MODULE_NAMES[state.selectedModule]}</strong>
          </p>
        </section>

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
              {stands.map((s, i) => (
                <li key={s.id}>
                  <button
                    className={`stand-item ${state.selectedStandId === s.id ? 'active' : ''}`}
                    onClick={() => actions.selectStand(s.id)}
                  >
                    <span className="swatch" style={{ background: s.color }} />
                    <span>Nivel {i + 1}</span>
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
