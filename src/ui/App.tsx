import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { StadiumView } from '../three/StadiumView';
import { actions, canUndo, getState, subscribe, undoLast } from '../store';
import { APP_VERSION } from '../config';
import { EditorPanel } from './EditorPanel';
import { EnvironmentPanel } from './EnvironmentPanel';
import { DialogHost } from './DialogHost';
import { exportFlow, importFlow, libraryFlow, pngFlow, resetFlow, saveFlow } from './flows';

function RotateIcon({ dir }: { dir: 'left' | 'right' }) {
  // Flechas curvas de trazo
  return dir === 'left' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
      <polyline points="3 3 3 8 8 8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
      <polyline points="21 3 21 8 16 8" />
    </svg>
  );
}

export function App() {
  const state = useSyncExternalStore(subscribe, getState);
  const fileRef = useRef<HTMLInputElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtn = useRef<HTMLButtonElement>(null);

  const toggleMenu = () => {
    if (!menuOpen && menuBtn.current) {
      const r = menuBtn.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setMenuOpen((o) => !o);
  };
  const inEnv = state.mode === 'environment';

  // Ctrl+Z / Cmd+Z deshace (fuera de campos de texto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      undoLast();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Al seleccionar una grada se abre el editor
  useEffect(() => {
    if (state.selectedStandId) setPanelOpen(true);
  }, [state.selectedStandId]);

  const fromMenu = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const switchMode = (mode: 'stadium' | 'environment') => {
    actions.setMode(mode);
    setPanelOpen(true);
  };

  return (
    <div className={`app ${panelOpen ? 'panel-open' : ''}`}>
      <header className="toolbar glass">
        <div className="brand">
          <img className="logo" src="./logo.svg" alt="" width="32" height="32" />
          <div>
            <strong>Piixell</strong>
            <small>v{APP_VERSION}</small>
          </div>
        </div>
        <div className="tools">
          <div className="segmented" role="tablist" aria-label="Modo">
            <button
              role="tab"
              aria-selected={!inEnv}
              className={!inEnv ? 'active' : ''}
              onClick={() => switchMode('stadium')}
            >
              Estadio
            </button>
            <button
              role="tab"
              aria-selected={inEnv}
              className={inEnv ? 'active' : ''}
              onClick={() => switchMode('environment')}
            >
              Entorno
            </button>
          </div>
          <button
            className="btn icon undo-btn"
            aria-label="Deshacer"
            title="Deshacer (Ctrl+Z)"
            disabled={!canUndo()}
            onClick={() => undoLast()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="undo-icon">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
          <div className="menu-wrap">
            <button
              ref={menuBtn}
              className="btn icon"
              aria-label="Menú"
              aria-expanded={menuOpen}
              onClick={toggleMenu}
            >
              ☰
            </button>
            {menuOpen && createPortal(
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="menu glass" role="menu" style={{ top: menuPos.top, right: menuPos.right }}>
                  <button className="menu-item danger" role="menuitem" onClick={fromMenu(() => resetFlow())}>Nuevo</button>
                  <button className="menu-item" role="menuitem" onClick={fromMenu(() => saveFlow())}>Guardar</button>
                  <button className="menu-item" role="menuitem" onClick={fromMenu(() => libraryFlow())}>Cargar</button>
                  <button className="menu-item" role="menuitem" onClick={fromMenu(() => exportFlow())}>Exportar</button>
                  <button className="menu-item" role="menuitem" onClick={fromMenu(() => fileRef.current?.click())}>Importar</button>
                  <button className="menu-item" role="menuitem" onClick={fromMenu(() => pngFlow())}>Descargar PNG</button>
                </div>
              </>,
              document.body,
            )}
          </div>
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
        </div>
      </header>

      <main className="stage glass">
        <StadiumView />
        <div className="segmented lighting-seg" role="tablist" aria-label="Iluminación">
          <button
            role="tab"
            aria-selected={state.lighting === 'day'}
            className={state.lighting === 'day' ? 'active' : ''}
            onClick={() => actions.setLighting('day')}
          >
            Día
          </button>
          <button
            role="tab"
            aria-selected={state.lighting === 'night'}
            className={state.lighting === 'night' ? 'active' : ''}
            onClick={() => actions.setLighting('night')}
          >
            Noche
          </button>
        </div>
        <div className="rotate-controls">
          <button className="round-btn" aria-label="Girar a la izquierda" onClick={() => actions.rotate(1)}>
            <RotateIcon dir="left" />
          </button>
          <button
            className={`round-btn ${state.view === 'top' ? 'active' : ''}`}
            aria-label={state.view === 'top' ? 'Volver a la vista isométrica' : 'Vista cenital'}
            title={state.view === 'top' ? 'Vista isométrica' : 'Vista cenital'}
            onClick={() => actions.setView(state.view === 'top' ? 'iso' : 'top')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M4 12h16M12 4v16" />
            </svg>
          </button>
          <button className="round-btn" aria-label="Girar a la derecha" onClick={() => actions.rotate(-1)}>
            <RotateIcon dir="right" />
          </button>
        </div>
      </main>

      {inEnv
        ? <EnvironmentPanel open={panelOpen} setOpen={setPanelOpen} />
        : <EditorPanel open={panelOpen} setOpen={setPanelOpen} />}
      <DialogHost />
    </div>
  );
}
