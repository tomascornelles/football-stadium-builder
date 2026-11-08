/** Versión de la aplicación (SemVer). */
export const APP_VERSION = '0.15.0';

/** Dimensiones fijas del campo en metros (1 unidad = 1 m). */
export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;

/** Distancia por defecto entre la línea de banda y la primera fila de una grada. */
export const STAND_GAP = 6;

/** Altura aproximada de cada fila de asientos (m). */
export const ROW_RISE = 0.6;

/** Límites de los controles del editor. */
export const LIMITS = {
  height: { min: 2, max: 24, step: 0.5 },
  tilt: { min: 15, max: 40, step: 1 },
  offset: { min: -5, max: 25, step: 0.5 },
} as const;

export const STORAGE_KEY = 'football-stadium-builder:v1';

export const PALETTE = ['#2f6fdb', '#e0472f', '#f2b233', '#2fb37a', '#8e5bd6', '#e5e7eb'];

/** Cuadrícula del entorno: 400 × 400 m con celdas de 20 m. */
export const ENV_SIZE = 400;
export const ENV_CELL = 20;
export const ENV_HALF = ENV_SIZE / 2;
export const ENV_N = ENV_SIZE / ENV_CELL;
