import { getState } from './store';
import { sanitizeEnvironment } from './environment';
import { LIMITS } from './config';
import { resolveFacade } from './migrate';
import {
  DEFAULT_EXTERIOR,
  EXTERIOR_RANGES,
  EnvCell,
  migrateCurve,
  FLOOD_OPTIONS,
  MODULE_IDS,
  ModuleExterior,
  ModuleId,
  Option,
  DECO_OPTIONS,
  ROOF_DECO_OPTIONS,
  ROOF_OPTIONS,
  SCORE_OPTIONS,
  Stand,
  TOWER_POS_OPTIONS,
} from './types';

export const FILE_FORMAT = 'football-stadium-builder';
export const FILE_FORMAT_VERSION = 1;
const LIBRARY_KEY = 'football-stadium-builder:library';

export interface Project {
  format: string;
  formatVersion: number;
  name: string;
  savedAt: string;
  stands: Stand[];
  exteriors: Record<ModuleId, ModuleExterior>;
  environment?: Record<string, EnvCell>;
}

export interface SavedStadium {
  id: string;
  name: string;
  savedAt: string;
  project: Project;
  /** Miniatura JPEG en base64 (opcional). */
  thumb?: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** Estadio actual en formato de archivo. */
export function currentProject(name: string): Project {
  const s = getState();
  return {
    format: FILE_FORMAT,
    formatVersion: FILE_FORMAT_VERSION,
    name,
    savedAt: new Date().toISOString(),
    stands: s.stands,
    exteriors: s.exteriors,
    environment: s.environment,
  };
}

function toStand(raw: any, rawExt?: any): Stand {
  if (
    !raw || typeof raw.id !== 'string' || !MODULE_IDS.includes(raw.moduleId) ||
    !isNum(raw.height) || !isNum(raw.tilt) || !isNum(raw.offset) || !isNum(raw.order) ||
    !isColor(raw.color)
  ) {
    throw new Error('Hay gradas con datos no válidos.');
  }
  return {
    id: raw.id,
    moduleId: raw.moduleId,
    order: raw.order,
    height: clamp(raw.height, LIMITS.height.min, LIMITS.height.max),
    tilt: clamp(raw.tilt, LIMITS.tilt.min, LIMITS.tilt.max),
    offset: clamp(raw.offset, LIMITS.offset.min, LIMITS.offset.max),
    color: raw.color,
    aisleColor: isColor(raw.aisleColor) ? raw.aisleColor : '#E8DCC4',
    railing: raw.railing === true,
    curve: migrateCurve(raw),
    facade: resolveFacade(raw, rawExt),
  };
}

function pick<T extends string>(value: unknown, options: Option<T>[], fallback: T): T {
  return options.some((o) => o.value === value) ? (value as T) : fallback;
}

function toExterior(raw: any): ModuleExterior {
  const merged: Record<string, unknown> = { ...DEFAULT_EXTERIOR, ...(raw ?? {}) };
  for (const key of Object.keys(EXTERIOR_RANGES) as (keyof ModuleExterior)[]) {
    const range = EXTERIOR_RANGES[key];
    const val = merged[key];
    if (range && isNum(val)) merged[key] = clamp(val, range[0], range[1]);
  }
  const ext = merged as unknown as ModuleExterior;
  return {
    ...ext,
    // Compatibilidad: el antiguo marcador de marquesina pasa a ser un tipo de marcador
    score: pick(ext.score === 'none' && (ext as any).roofScore === true ? 'marquesina' : ext.score, SCORE_OPTIONS, 'none'),
    // Compatibilidad: la antigua marquesina plana pasa a voladizo sin inclinación
    roof: pick((ext.roof as string) === 'canopy' ? 'cantilever' : ext.roof, ROOF_OPTIONS, 'none'),
    roofAngle: (ext.roof as string) === 'canopy' ? 0 : ext.roofAngle,
    flood: pick(ext.flood, FLOOD_OPTIONS, 'none'),
    deco: pick(ext.deco, DECO_OPTIONS, 'none'),
    roofDeco: pick(ext.roofDeco, ROOF_DECO_OPTIONS, 'none'),
    roofDecoColor: isColor(ext.roofDecoColor) ? ext.roofDecoColor : DEFAULT_EXTERIOR.roofDecoColor,
    decoColor: isColor(ext.decoColor) ? ext.decoColor : DEFAULT_EXTERIOR.decoColor,
    circleTowerPos: pick(ext.circleTowerPos, TOWER_POS_OPTIONS, 'center'),
    circleTowerColor: isColor(ext.circleTowerColor) ? ext.circleTowerColor : DEFAULT_EXTERIOR.circleTowerColor,
    roofColor: isColor(ext.roofColor) ? ext.roofColor : DEFAULT_EXTERIOR.roofColor,
    floodColor: isColor(ext.floodColor) ? ext.floodColor : DEFAULT_EXTERIOR.floodColor,
    roofColumns: ext.roofColumns === true,
  };
}

/** Lee y valida un archivo de estadio. Lanza Error con un mensaje legible si no es válido. */
export function parseProject(text: string): Project {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('El archivo no contiene JSON válido.');
  }
  if (!raw || raw.format !== FILE_FORMAT) {
    throw new Error('El archivo no es un estadio de Football Stadium Builder.');
  }
  if (!Array.isArray(raw.stands)) throw new Error('El archivo no contiene gradas.');

  const exteriors = {} as Record<ModuleId, ModuleExterior>;
  for (const id of MODULE_IDS) exteriors[id] = toExterior(raw.exteriors?.[id]);

  return {
    format: FILE_FORMAT,
    formatVersion: FILE_FORMAT_VERSION,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Estadio importado',
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
    stands: raw.stands.map((r: any) => toStand(r, raw.exteriors?.[r?.moduleId])),
    exteriors,
    environment: sanitizeEnvironment(raw.environment),
  };
}

/* ---------- Biblioteca local ---------- */

export function listSaved(): SavedStadium[] {
  try {
    const arr = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLibrary(list: SavedStadium[]) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  } catch {
    throw new Error('quota');
  }
}

export function findSavedByName(name: string): SavedStadium | undefined {
  return listSaved().find((e) => e.name === name);
}

/** Guarda el estadio actual en la biblioteca. Si ya existe el nombre, lo reemplaza. */
export function saveToLibrary(name: string, thumb?: string): SavedStadium {
  const list = listSaved();
  const project = currentProject(name);
  const existing = list.find((e) => e.name === name);
  const entry: SavedStadium = {
    id: existing?.id ?? Date.now().toString(36),
    name,
    savedAt: project.savedAt,
    project,
    thumb,
  };
  const next = existing
    ? list.map((e) => (e.id === existing.id ? entry : e))
    : [entry, ...list];
  writeLibrary(next);
  return entry;
}

export function deleteFromLibrary(id: string) {
  writeLibrary(listSaved().filter((e) => e.id !== id));
}

/* ---------- Descarga de archivo ---------- */

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'estadio';
}

export function downloadProject(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(project.name)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
