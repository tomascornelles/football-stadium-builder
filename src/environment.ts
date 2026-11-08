import { CellType, EnvCell } from './types';
import { ENV_CELL, ENV_HALF, ENV_N } from './config';

export const CELL_TYPES: CellType[] = ['road', 'path', 'park', 'building'];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const cellKey = (i: number, j: number) => `${i},${j}`;

/** Celda de la cuadrícula bajo un punto del plano (x, z), o null si está fuera. */
export function cellFromPoint(x: number, z: number): { i: number; j: number } | null {
  const i = Math.floor((x + ENV_HALF) / ENV_CELL);
  const j = Math.floor((z + ENV_HALF) / ENV_CELL);
  if (i < 0 || j < 0 || i >= ENV_N || j >= ENV_N) return null;
  return { i, j };
}

/** Valida el entorno de un archivo o del almacenamiento local. */
export function sanitizeEnvironment(raw: unknown): Record<string, EnvCell> {
  const out: Record<string, EnvCell> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, val] of Object.entries(raw as Record<string, any>)) {
    const m = /^(\d+),(\d+)$/.exec(key);
    if (!m) continue;
    const i = Number(m[1]);
    const j = Number(m[2]);
    if (i >= ENV_N || j >= ENV_N || !val || !CELL_TYPES.includes(val.type)) continue;
    const cell: EnvCell = { type: val.type };
    if (val.type === 'building') {
      cell.height = clamp(Number(val.height) || 12, 3, 60);
      cell.color = typeof val.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.color) ? val.color : '#d6d3cd';
    }
    if (val.type === 'park' && val.tree === true) cell.tree = true;
    out[key] = cell;
  }
  return out;
}
