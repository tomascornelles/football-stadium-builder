/**
 * Captura del escenario: el visor registra cómo obtener su lienzo, y aquí se
 * compone la imagen con un fondo oscuro para PNG y miniaturas.
 */
let source: (() => HTMLCanvasElement) | null = null;

export function registerCapture(fn: (() => HTMLCanvasElement) | null) {
  source = fn;
}

function compose(w: number, h: number, src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#16273d');
  grad.addColorStop(1, '#0a1420');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const s = Math.min(w / src.width, h / src.height);
  const dw = src.width * s;
  const dh = src.height * s;
  g.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

/** Imagen PNG del escenario actual, o null si no hay escenario. */
export function pngDataUrl(): string | null {
  const src = source?.();
  if (!src) return null;
  return compose(src.width, src.height, src).toDataURL('image/png');
}

/** Miniatura JPEG pequeña para la biblioteca de estadios guardados. */
export function thumbnailDataUrl(): string | null {
  const src = source?.();
  if (!src) return null;
  return compose(320, 200, src).toDataURL('image/jpeg', 0.8);
}
