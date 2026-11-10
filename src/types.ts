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

export interface Option<T extends string> {
  value: T;
  label: string;
}

/* ---------- Pilares de grada ---------- */

export type ColumnMode = 'none' | 'inner' | 'outer';

export const COLUMN_OPTIONS: Option<ColumnMode>[] = [
  { value: 'none', label: 'Sin pilares' },
  { value: 'inner', label: 'Pilares interiores' },
  { value: 'outer', label: 'Pilares exteriores' },
];

/** Convierte el campo antiguo «columns» (booleano) en el modo actual. */
export function migrateColumns(raw: { columns?: unknown }): ColumnMode {
  if (raw.columns === 'none' || raw.columns === 'inner' || raw.columns === 'outer') return raw.columns;
  return raw.columns === true ? 'outer' : 'none';
}

/* ---------- Fachada por grada ---------- */

export type FacadeKind = 'none' | 'pillars' | 'solid' | 'vpanels' | 'hpanels';

export const FACADE_OPTIONS: Option<FacadeKind>[] = [
  { value: 'none', label: 'Sin fachada' },
  { value: 'pillars', label: 'Pilares exteriores' },
  { value: 'solid', label: 'Fachada lisa' },
  { value: 'vpanels', label: 'Paneles verticales' },
  { value: 'hpanels', label: 'Paneles horizontales' },
];

/** Fachada de una grada. Su altura es la de la propia grada. */
export interface StandFacade {
  kind: FacadeKind;
  /** Grosor de la fachada desde el borde trasero de la grada hacia fuera (m). */
  depth: number;
  color: string;
  /** Segundo color, para paneles alternados. */
  colorB: string;
  /** Número de divisiones de los paneles. */
  count: number;
  /** Pilares exteriores: distancia de su centro a la cara exterior de la fachada (m). + fuera, − dentro. */
  pillarOffset?: number;
}

export const FACADE_RANGES = { depth: [0.5, 40] as [number, number], count: [2, 30] as [number, number] };

export const DEFAULT_FACADE: StandFacade = {
  kind: 'none',
  depth: 2,
  color: '#9aa3ad',
  colorB: '#e5e7eb',
  count: 8,
};

/** Fachada equivalente a un valor antiguo de fachada por módulo (migración). */
export function legacyFacade(wall: unknown, distance: unknown, color: unknown): StandFacade | null {
  const map: Record<string, FacadeKind> = {
    concrete: 'solid', glass: 'solid', brick: 'solid', windows: 'hpanels', panels: 'vpanels',
  };
  if (typeof wall !== 'string' || !map[wall]) return null;
  const depth = typeof distance === 'number' ? Math.min(40, Math.max(0.5, distance)) : 2;
  const c = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_FACADE.color;
  return { ...DEFAULT_FACADE, kind: map[wall], depth, color: c };
}

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
  /** Pilares de sustentación bajo la grada (solo en tribunas elevadas). */
  columns: ColumnMode;
  /** Barandilla en el frente de la grada. */
  railing: boolean;
  /** Curvatura de la grada (solo en módulos rectos). */
  curve: CurveType;
  /** Fachada de la grada. */
  facade: StandFacade;
}

export type CurveType = 'straight' | 'mid';

export const CURVE_OPTIONS: Option<CurveType>[] = [
  { value: 'straight', label: 'Recta' },
  { value: 'mid', label: 'Curva' },
];

/** Flecha de la curva según su tipo (m, hacia fuera del campo). */
export const CURVE_BULGE_BY: Record<CurveType, number> = { straight: 0, mid: 6 };

/** Convierte el campo antiguo «curved» (booleano) en el nuevo tipo de curvatura. */
export function migrateCurve(raw: { curve?: unknown; curved?: unknown }): CurveType {
  if (raw.curve === 'straight' || raw.curve === 'mid') return raw.curve;
  // Las antiguas «Curva» (grande) y «Curva intermedia» pasan a «Curva»
  if (raw.curve === 'full') return 'mid';
  return raw.curved === true ? 'mid' : 'straight';
}

export type RoofType = 'none' | 'canopy' | 'cantilever' | 'arch';
export type FloodType = 'none' | 'mast' | 'bar';
export type ScoreType = 'none' | 'marcador' | 'pantalla' | 'marquesina';
export type DecoType = 'none' | 'pillars' | 'towers' | 'struts' | 'arches';
export type RoofDecoType = 'none' | 'trusses' | 'masts' | 'lattice';
export type TowerPos = 'left' | 'center' | 'right';

export const ROOF_DECO_OPTIONS: Option<RoofDecoType>[] = [
  { value: 'none', label: 'Sin decoración' },
  { value: 'trusses', label: 'Armaduras' },
  { value: 'masts', label: 'Mástiles con tirantes' },
  { value: 'lattice', label: 'Celosía' },
];

export const TOWER_POS_OPTIONS: Option<TowerPos>[] = [
  { value: 'left', label: 'Izquierda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Derecha' },
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
  { value: 'marquesina', label: 'Marcador de marquesina' },
];

/** Exteriores y detalles de un módulo. La fachada va por grada. */
export interface ModuleExterior {
  roof: RoofType;
  /** Altura de la cubierta sobre la grada más alta (m). */
  roofHeight: number;
  roofOverhang: number;
  /** Ancho de la cubierta en planta (m). 0 = automático, según las gradas. */
  roofWidth: number;
  /** Extensión de la cubierta hacia el interior, sobre el campo (m). */
  roofInset: number;
  roofThickness: number;
  /** Flecha de la cubierta curva (grados). */
  roofSlope: number;
  /** Inclinación del voladizo (°). Positivo: el borde exterior sube. Negativo: baja. */
  roofAngle: number;
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

  /** Escaleras exteriores en zigzag, tramos de 5 m. */
  stairs: boolean;
  /** Torres circulares adjuntas a la fachada (0 a 3). */
  circleTowers: number;
  circleTowerHeight: number;
  /** Posición cuando hay una sola torre. */
  circleTowerPos: TowerPos;
  circleTowerColor: string;
}

export const DEFAULT_EXTERIOR: ModuleExterior = {
  roof: 'none',
  roofHeight: 4,
  roofOverhang: 4,
  roofWidth: 0,
  roofInset: 0,
  roofThickness: 1,
  roofSlope: 12,
  roofAngle: 0,
  roofColumns: false,
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

  stairs: false,
  circleTowers: 0,
  circleTowerHeight: 20,
  circleTowerPos: 'center',
  circleTowerColor: '#e5e7eb',
};

/** Rangos numéricos válidos de los exteriores. */
export const EXTERIOR_RANGES: Partial<Record<keyof ModuleExterior, [number, number]>> = {
  roofHeight: [1, 20],
  roofOverhang: [0, 12],
  roofWidth: [0, 80],
  roofInset: [0, 40],
  roofThickness: [0.5, 3],
  roofSlope: [0, 25],
  roofAngle: [-20, 20],
  floodCount: [1, 4],
  floodHeight: [8, 60],
  scoreHeight: [4, 40],
  scoreWidth: [2, 20],
  decoCount: [1, 12],
  decoHeight: [4, 60],
  roofDecoCount: [1, 12],
  roofDecoHeight: [2, 20],
  circleTowers: [0, 3],
  circleTowerHeight: [8, 60],
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

export type StandPatch = Partial<
  Pick<Stand, 'height' | 'tilt' | 'offset' | 'color' | 'columns' | 'railing' | 'curve' | 'facade'>
>;
