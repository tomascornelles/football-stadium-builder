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
  /** Grada curva (solo en módulos rectos). */
  curved: boolean;
}

export type WallType = 'none' | 'concrete' | 'glass' | 'brick' | 'windows' | 'panels';
export type RoofType = 'none' | 'canopy' | 'cantilever' | 'arch';
export type FloodType = 'none' | 'mast' | 'bar';
export type ScoreType = 'none' | 'marcador' | 'pantalla';
export type DecoType = 'none' | 'pillars' | 'towers' | 'struts' | 'arches';
export type RoofDecoType = 'none' | 'trusses' | 'masts' | 'ridge';

export const ROOF_DECO_OPTIONS: Option<RoofDecoType>[] = [
  { value: 'none', label: 'Sin decoración' },
  { value: 'trusses', label: 'Armaduras' },
  { value: 'masts', label: 'Mástiles con tirantes' },
  { value: 'ridge', label: 'Viga de coronación' },
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
  roofThickness: number;
  /** Inclinación (voladizo) o flecha (cubierta curva), en grados. */
  roofSlope: number;
  roofColumns: boolean;
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
  roofThickness: 1,
  roofSlope: 12,
  roofColumns: true,
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

export type CellType = 'road' | 'path' | 'park' | 'building';
export type EnvTool = 'road' | 'path' | 'tree' | 'building' | 'erase';
export type BuildingKind = 'house' | 'building' | 'tower';

export const BUILDING_HEIGHT: Record<BuildingKind, number> = { house: 7, building: 24, tower: 50 };
export type AppMode = 'stadium' | 'environment';

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
  { value: 'road', label: 'Carretera', color: '#4b5563' },
  { value: 'path', label: 'Camino', color: '#d6c7a1' },
  { value: 'tree', label: 'Árboles', color: '#2f855a' },
  { value: 'building', label: 'Edificio', color: '#d6d3cd' },
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
}

export type StandPatch = Partial<Pick<Stand, 'height' | 'tilt' | 'offset' | 'color' | 'columns' | 'railing' | 'curved'>>;
