import { useEffect, useState, useSyncExternalStore } from 'react';
import { actions } from '../store';
import { listSaved } from '../persistence';
import { closeDialog, getDialogState, loadDialog, subscribeDialog } from './dialog';
import { deleteSavedFlow, requestLoad } from './flows';

export function DialogHost() {
  const pending = useSyncExternalStore(subscribeDialog, getDialogState);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  if (!pending) return null;
  const req = pending.req;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeDialog();
      }}
    >
      <div className="modal glass" role="dialog" aria-modal="true">
        {req.kind === 'alert' && (
          <>
            <h2>{req.title}</h2>
            <p>{req.message}</p>
            <div className="modal-actions">
              <button className="btn primary" onClick={() => closeDialog()}>Aceptar</button>
            </div>
          </>
        )}

        {req.kind === 'confirm' && (
          <>
            <h2>{req.title}</h2>
            <p>{req.message}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => closeDialog(false)}>Cancelar</button>
              <button
                className={req.danger ? 'btn solid-danger' : 'btn primary'}
                onClick={() => closeDialog(true)}
              >
                {req.confirmLabel}
              </button>
            </div>
          </>
        )}

        {req.kind === 'save' && <SaveBody title={req.title} defaultName={req.defaultName} confirmLabel={req.confirmLabel} />}

        {req.kind === 'load' && <LoadBody />}
      </div>
    </div>
  );
}

function SaveBody({ title, defaultName, confirmLabel }: { title: string; defaultName: string; confirmLabel: string }) {
  const [name, setName] = useState(defaultName);
  const valid = name.trim().length > 0;
  const submit = () => {
    if (valid) closeDialog(name.trim());
  };

  return (
    <>
      <h2>{title}</h2>
      <input
        type="text"
        value={name}
        autoFocus
        maxLength={60}
        placeholder="Nombre del estadio"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <div className="modal-actions">
        <button className="btn" onClick={() => closeDialog(null)}>Cancelar</button>
        <button className="btn primary" disabled={!valid} onClick={submit}>{confirmLabel}</button>
      </div>
    </>
  );
}

function LoadBody() {
  const [items] = useState(() => listSaved());

  const onLoad = async (item: ReturnType<typeof listSaved>[number]) => {
    const ok = await requestLoad(item.project, item.name);
    if (!ok) loadDialog();
  };

  const onDelete = async (item: ReturnType<typeof listSaved>[number]) => {
    await deleteSavedFlow(item.id, item.name);
    // Se reabre la biblioteca para mostrar la lista actualizada
    loadDialog();
  };

  return (
    <>
      <h2>Cargar estadio</h2>
      {items.length === 0 ? (
        <p>No hay estadios guardados en este dispositivo.</p>
      ) : (
        <ul className="saved-list">
          {items.map((item) => (
            <li key={item.id} className="saved-item">
              <div className="info">
                <strong>{item.name}</strong>
                <small>{new Date(item.savedAt).toLocaleString('es-ES')} · {item.project.stands.length} gradas</small>
              </div>
              <button className="btn small primary" onClick={() => onLoad(item)}>Cargar</button>
              <button className="btn small danger" onClick={() => onDelete(item)}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={() => closeDialog()}>Cerrar</button>
      </div>
    </>
  );
}
