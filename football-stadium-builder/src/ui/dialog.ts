/**
 * Diálogos modales propios (sustituyen a alert, confirm y prompt del navegador).
 * Cada llamada devuelve una promesa que se resuelve al cerrar el diálogo.
 */
export type DialogRequest =
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean }
  | { kind: 'alert'; title: string; message: string }
  | { kind: 'save'; title: string; defaultName: string; confirmLabel: string }
  | { kind: 'load' };

interface Pending {
  req: DialogRequest;
  resolve: (value: unknown) => void;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getDialogState(): Pending | null {
  return pending;
}

export function subscribeDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function defaultValue(req: DialogRequest): unknown {
  switch (req.kind) {
    case 'confirm': return false;
    case 'save': return null;
    default: return undefined;
  }
}

function open<T>(req: DialogRequest): Promise<T> {
  return new Promise<T>((resolve) => {
    if (pending) pending.resolve(defaultValue(pending.req));
    pending = { req, resolve: resolve as (v: unknown) => void };
    emit();
  });
}

/** Cierra el diálogo activo. Sin valor, se usa el valor por defecto de su tipo. */
export function closeDialog(value?: unknown) {
  if (!pending) return;
  const p = pending;
  pending = null;
  p.resolve(value === undefined ? defaultValue(p.req) : value);
  emit();
}

export const confirmDialog = (opts: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}) => open<boolean>({ kind: 'confirm', ...opts });

export const alertDialog = (title: string, message: string) =>
  open<void>({ kind: 'alert', title, message });

export const saveDialog = (title: string, defaultName: string, confirmLabel: string) =>
  open<string | null>({ kind: 'save', title, defaultName, confirmLabel });

export const loadDialog = () => open<void>({ kind: 'load' });
