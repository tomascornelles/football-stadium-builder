import { ColorPicker } from './ColorPicker';
import { useSyncExternalStore, type ReactElement } from 'react';
import { actions, getState, subscribe } from '../store';
import { BUILDING_OPTIONS, ENV_TOOLS, ROAD_OPTIONS } from '../types';
import { confirmDialog } from './dialog';

const TOOL_ICONS: Record<string, ReactElement> = {
  road: <path d="M7 3v18M17 3v18M12 4v3M12 10.5v3M12 17v3" />,
  tree: <><circle cx="12" cy="9" r="5.5" /><path d="M12 14.5V21" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15" /></>,
  water: <path d="M2 9c2.5-2 5-2 7.5 0s5 2 7.5 0 3-1.6 5-.5M2 15c2.5-2 5-2 7.5 0s5 2 7.5 0 3-1.6 5-.5" />,
  erase: <path d="M6 6l12 12M18 6L6 18" />,
};

interface EnvironmentPanelProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export function EnvironmentPanel({ open, setOpen }: EnvironmentPanelProps) {
  const state = useSyncExternalStore(subscribe, getState);
  const toolLabel = ENV_TOOLS.find((t) => t.value === state.tool)?.label ?? '';

  return (
    <aside className={`panel glass ${open ? 'open' : ''}`}>
      <div className="panel-head">
        <button className="panel-handle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="grip" /> Entorno · {toolLabel}
        </button>
      </div>

      <div className="panel-body">
        <section>
          <h2 className="section-title">Herramienta</h2>
          <div className="tool-bar" role="group" aria-label="Herramientas del entorno">
            {ENV_TOOLS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`tool-bar-btn tool-${t.value} ${state.tool === t.value ? 'active' : ''}`}
                aria-pressed={state.tool === t.value}
                aria-label={t.label}
                title={t.label}
                onClick={() => actions.setTool(t.value)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">{TOOL_ICONS[t.value]}</svg>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {state.tool === 'road' && (
          <section className="editor">
            <h2 className="section-title">Tipo de vía</h2>
            <div className="segmented kind-segmented" role="tablist">
              {ROAD_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  role="tab"
                  aria-selected={state.roadKind === o.value}
                  className={state.roadKind === o.value ? 'active' : ''}
                  onClick={() => actions.setRoadKind(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>
        )}

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
              <ColorPicker
                
                value={state.buildingColor}
                onChange={(v) => actions.setBuildingColor(v)}
        />
            </label>
          </section>
        )}

        <section className="editor">
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
