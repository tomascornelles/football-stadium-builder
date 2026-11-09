export type ModuleId = 'west' | 'east' | 'north' | 'south' | 'nw' | 'ne' | 'sw' | 'se';

export const MODULE_IDS: ModuleId[] = ['west', 'east', 'north', 'south', 'nw', 'ne', 'sw', 'se'];

export const MODULE_NAMES: Record<ModuleId, string> = {
  west: 'Fondo oeste',
  east: 'Fondo este',
  north: 'Lateral norte',
  south: 'Lateral sur',
  nw: 'Esquina noroeste',
  ne: 'Esquina noreste',
  sw: 'Esquina suroeste',
  se: 'Esquina sureste',
};

/** Grada independiente. */
export interface Stand {
  id: string;
  moduleId: ModuleId;
  /** Orden de construcción dentro del módulo (1 = la más baja). */
  order: number;
  /** Altura total en metros. */
  height: number;
  /** Inclinación de las filas en grados. */
  tilt: number;
  color: string;
  /** Desplazamiento respecto a la línea de banda: + hacia fuera, − hacia el campo. */
  offset: number;
  /** Pilares de sustentación (solo en tribunas elevadas). */
  columns: boolean;
  /** Barandilla en el frente de la grada. */
  railing: boolean;
  /** Curvatura de la grada (solo en módulos rectos). */
  curve: CurveType;
}

export type CurveType = 'straight' | 'mid' | 'full';

export const CURVE_OPTIONS: Option<CurveType>[] = [
  { value: 'straight', label: 'Recta' },
  { value: 'mid', label: 'Curva intermedia' },
  { value: 'full', label: 'Curva' },
];

/** Flecha de la curva según su tipo (m, hacia fuera del campo). */
export const CURVE_BULGE_BY: Record<CurveType, number> = { straight: 0, mid: 6, full: 14 };

/** Convierte el campo antiguo «curved» (booleano) en el nuevo tipo de curvatura. */
export function migrateCurve(raw: { curve?: unknown; curved?: unknown }): CurveType {
  if (raw.curve === 'straight' || raw.curve === 'mid' || raw.curve === 'full') return raw.curve;
  return raw.curved === true ? 'full' : 'straight';
}

export type WallType = 'none' | 'concrete' | 'glass' | 'brick' | 'windows' | 'panels';
export type RoofType = 'none' | 'canopy' | 'cantilever' | 'arch';
export type FloodType = 'none' | 'mast' | 'bar';
export type ScoreType = 'none' | 'marcador' | 'pantalla';
export type DecoType = 'none' | 'pillars' | 'towers' | 'struts' | 'arches';
export type RoofDecoType = 'none' | 'trusses' | 'masts' | 'lattice';

export const ROOF_DECO_OPTIONS: Option<RoofDecoType>[] = [
  { value: 'none', label: 'Sin decoración' },
  { value: 'trusses', label: 'Armaduras' },
  { value: 'masts', label: 'Mástiles con tirantes' },
  { value: 'lattice', label: 'Celosía' },
];

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const WALL_OPTIONS: Option<WallType>[] = [
  { value: 'none', label: 'Sin fachada' },
  { value: 'concrete', label: 'Hormigón liso' },
  { value: 'glass', label: 'Cristal' },
  { value: 'brick', label: 'Ladrillo' },
  { value: 'windows', label: 'Ventanas corridas' },
  { value: 'panels', label: 'Paneles verticales' },
];

export const ROOF_OPTIONS: Option<RoofType>[] = [
  { value: 'none', label: 'Sin cubierta' },
  { value: 'canopy', label: 'Marquesina plana' },
  { value: 'cantilever', label: 'Voladizo inclinado' },
  { value: 'arch', label: 'Cubierta curva' },
];

export const FLOOD_OPTIONS: Option<FloodType>[] = [
  { value: 'none', label: 'Sin focos' },
  { value: 'mast', label: 'Torres de focos' },
  { value: 'bar', label: 'Barra en cubierta' },
];

export const DECO_OPTIONS: Option<DecoType>[] = [
  { value: 'none', label: 'Sin decoración' },
  { value: 'pillars', label: 'Pilares exteriores' },
  { value: 'towers', label: 'Torres' },
  { value: 'struts', label: 'Soportes de cubierta' },
  { value: 'arches', label: 'Arcos' },
];

export const SCORE_OPTIONS: Option<ScoreType>[] = [
  { value: 'none', label: 'Sin marcador' },
  { value: 'marcador', label: 'Marcador clásico' },
  { value: 'pantalla', label: 'Pantalla LED' },
];

/** Exteriores y detalles de un módulo. */
export interface ModuleExterior {
  wall: WallType;
  wallHeight: number;
  /** Distancia de la fachada al borde trasero de las gradas (m). */
  wallDistance: number;
  wallThickness: number;
  wallColor: string;

  roof: RoofType;
  /** Altura de la cubierta sobre la grada más alta (m). */
  roofHeight: number;
  roofOverhang: number;
  /** Ancho de la cubierta en planta (m). 0 = automático, según las gradas. */
  roofWidth: number;
  /** Extensión de la cubierta hacia el interior, sobre el campo (m). */
  roofInset: number;
  roofThickness: number;
  /** Inclinación (voladizo) o flecha (cubierta curva), en grados. */
  roofSlope: number;
  roofColumns: boolean;
  /** Marcador sobre la marquesina. */
  roofScore: boolean;
  roofColor: string;

  flood: FloodType;
  floodCount: number;
  floodHeight: number;
  floodColor: string;

  score: ScoreType;
  scoreHeight: number;
  scoreWidth: number;

  deco: DecoType;
  decoCount: number;
  decoHeight: number;
  decoColor: string;

  /** Decoración sobre la cubierta. */
  roofDeco: RoofDecoType;
  roofDecoCount: number;
  roofDecoHeight: number;
  roofDecoColor: string;
}

export const DEFAULT_EXTERIOR: ModuleExterior = {
  wall: 'none',
  wallHeight: 14,
  wallDistance: 4,
  wallThickness: 1.5,
  wallColor: '#9aa3ad',

  roof: 'none',
  roofHeight: 4,
  roofOverhang: 4,
  roofWidth: 0,
  roofInset: 0,
  roofThickness: 1,
  roofSlope: 12,
  roofColumns: false,
  roofScore: false,
  roofColor: '#e5e7eb',

  flood: 'none',
  floodCount: 2,
  floodHeight: 30,
  floodColor: '#fff7d6',

  score: 'none',
  scoreHeight: 12,
  scoreWidth: 8,

  deco: 'none',
  decoCount: 4,
  decoHeight: 12,
  decoColor: '#e5e7eb',

  roofDeco: 'none',
  roofDecoCount: 4,
  roofDecoHeight: 6,
  roofDecoColor: '#9ca3af',
};

/** Rangos numéricos válidos de los exteriores. */
export const EXTERIOR_RANGES: Partial<Record<keyof ModuleExterior, [number, number]>> = {
  wallHeight: [4, 40],
  wallDistance: [0, 30],
  wallThickness: [0.5, 4],
  roofHeight: [1, 20],
  roofOverhang: [0, 12],
  roofWidth: [0, 80],
  roofInset: [0, 40],
  roofThickness: [0.5, 3],
  roofSlope: [0, 25],
  floodCount: [1, 4],
  floodHeight: [8, 60],
  scoreHeight: [4, 40],
  scoreWidth: [2, 20],
  decoCount: [1, 12],
  decoHeight: [4, 60],
  roofDecoCount: [1, 12],
  roofDecoHeight: [2, 20],
};


/* ---------- Entorno ---------- */

export type CellType = 'road' | 'avenue' | 'path' | 'park' | 'building' | 'water';
export type RoadKind = 'road' | 'avenue' | 'path';

export const ROAD_OPTIONS: Option<RoadKind>[] = [
  { value: 'road', label: 'Carretera' },
  { value: 'avenue', label: 'Avenida' },
  { value: 'path', label: 'Camino' },
];
export type EnvTool = 'road' | 'tree' | 'building' | 'water' | 'erase';
export type BuildingKind = 'house' | 'building' | 'tower';

export const BUILDING_HEIGHT: Record<BuildingKind, number> = { house: 7, building: 24, tower: 75 };
export type AppMode = 'stadium' | 'environment';
export type Lighting = 'day' | 'night';
export type CameraView = 'iso' | 'top';

/** Celda ocupada de la cuadrícula. Las celdas vacías no aparecen en el mapa. */
export interface EnvCell {
  type: CellType;
  /** Solo edificios: tipo (casa, edificio o torre) y altura en metros. */
  kind?: BuildingKind;
  height?: number;
  /** Solo edificios: color de fachada. */
  color?: string;
  /** Solo parques: hay árboles en la celda. */
  tree?: boolean;
}

export const ENV_TOOLS: { value: EnvTool; label: string; color: string }[] = [
  { value: 'road', label: 'Vía', color: '#4b5563' },
  { value: 'tree', label: 'Árboles', color: '#2f855a' },
  { value: 'building', label: 'Edificio', color: '#d6d3cd' },
  { value: 'water', label: 'Agua', color: '#1f7a8c' },
  { value: 'erase', label: 'Borrar', color: '#1f2937' },
];

export const BUILDING_OPTIONS: Option<BuildingKind>[] = [
  { value: 'house', label: 'Casa' },
  { value: 'building', label: 'Edificio' },
  { value: 'tower', label: 'Torre' },
];

export interface AppState {
  stands: Stand[];
  exteriors: Record<ModuleId, ModuleExterior>;
  selectedModule: ModuleId;
  selectedStandId: string | null;
  /** Número de giros de 90° acumulados (la vista se calcula con módulo 4). */
  rotationSteps: number;
  environment: Record<string, EnvCell>;
  mode: AppMode;
  tool: EnvTool;
  buildingKind: BuildingKind;
  buildingColor: string;
  lighting: Lighting;
  view: CameraView;
  roadKind: RoadKind;
}

export type StandPatch = Partial<Pick<Stand, 'height' | 'tilt' | 'offset' | 'color' | 'columns' | 'railing' | 'curve'>>;
