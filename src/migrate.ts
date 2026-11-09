import { DEFAULT_FACADE, FACADE_RANGES, FacadeKind, FACADE_OPTIONS, ModuleExterior, StandFacade, legacyFacade } from './types';

const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Valida una fachada guardada. Devuelve null si no es válida. */
export function sanitizeFacade(raw: any): StandFacade | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!FACADE_OPTIONS.some((o) => o.value === raw.kind)) return null;
  const depth = typeof raw.depth === 'number' && Number.isFinite(raw.depth) ? raw.depth : 0;
  const count = typeof raw.count === 'number' && Number.isFinite(raw.count) ? raw.count : DEFAULT_FACADE.count;
  return {
    kind: raw.kind as FacadeKind,
    depth: clamp(depth, FACADE_RANGES.depth[0], FACADE_RANGES.depth[1]),
    count: Math.round(clamp(count, FACADE_RANGES.count[0], FACADE_RANGES.count[1])),
    color: isColor(raw.color) ? raw.color : DEFAULT_FACADE.color,
    colorB: isColor(raw.colorB) ? raw.colorB : DEFAULT_FACADE.colorB,
  };
}

/**
 * Fachada de una grada al cargar. Si el archivo es anterior a la fachada por grada,
 * se toma la antigua fachada del módulo (muro) como punto de partida.
 */
export function resolveFacade(rawStand: any, rawExt?: Partial<ModuleExterior> & Record<string, unknown>): StandFacade {
  const own = sanitizeFacade(rawStand?.facade);
  if (own) return own;
  const legacy = rawExt ? legacyFacade(rawExt.wall, rawExt.wallDistance, rawExt.wallColor) : null;
  return legacy ?? { ...DEFAULT_FACADE };
}
