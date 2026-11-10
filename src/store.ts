import {
  AppMode,
  AppState,
  CameraView,
  RoadKind,
  migrateCurve,
  BUILDING_HEIGHT,
  Lighting,
  BuildingKind,
  DEFAULT_EXTERIOR,
  DEFAULT_FACADE,
  EXTERIOR_RANGES,
  MODULE_IDS,
  ModuleExterior,
  ModuleId,
  EnvCell,
  EnvTool,
  Stand,
  StandPatch,
} from './types';
import { LIMITS, PALETTE, STORAGE_KEY } from './config';
import { resolveFacade, sanitizeFacade } from './migrate';
import { cellKey, sanitizeEnvironment } from './environment';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function defaultExteriors(): Record<ModuleId, ModuleExterior> {
  const out = {} as Record<ModuleId, ModuleExterior>;
  for (const id of MODULE_IDS) out[id] = { ...DEFAULT_EXTERIOR };
  return out;
}

function defaultState(): AppState {
  return {
    stands: [],
    exteriors: defaultExteriors(),
    selectedModule: 'west',
    selectedStandId: null,
    rotationSteps: 0,
    environment: {},
    mode: 'stadium',
    tool: 'road',
    buildingKind: 'building',
    buildingColor: '#d6d3cd',
    lighting: 'day',
    view: 'iso',
    roadKind: 'road',
  };
}

function isValidStand(s: unknown): s is Stand {
  const x = s as Stand;
  return !!x && typeof x.id === 'string' && MODULE_IDS.includes(x.moduleId) &&
    typeof x.height === 'number' && typeof x.tilt === 'number' &&
    typeof x.offset === 'number' && typeof x.color === 'string' && typeof x.order === 'number';
}

/** Aplica límites numéricos a un parche de exteriores. */
function sanitize(patch: Partial<ModuleExterior>): Partial<ModuleExterior> {
  const out = { ...patch } as Record<string, unknown>;
  for (const key of Object.keys(EXTERIOR_RANGES) as (keyof ModuleExterior)[]) {
    const range = EXTERIOR_RANGES[key];
    const val = out[key];
    if (range && typeof val === 'number') out[key] = clamp(val, range[0], range[1]);
  }
  return out as Partial<ModuleExterior>;
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const exteriors = defaultExteriors();
    const saved = (parsed.exteriors ?? {}) as Partial<Record<ModuleId, Partial<ModuleExterior>>>;
    for (const id of MODULE_IDS) exteriors[id] = { ...DEFAULT_EXTERIOR, ...(saved[id] ?? {}) };
    const stands = (parsed.stands ?? [])
      .filter(isValidStand)
      .map((s) => ({
        ...s,
        railing: s.railing === true,
        curve: migrateCurve(s),
        facade: resolveFacade(s, parsed.exteriors?.[s.moduleId] as any),
      }));
    return {
      stands,
      exteriors,
      environment: sanitizeEnvironment(parsed.environment),
      mode: 'stadium',
      tool: 'road',
      buildingKind: 'building',
      buildingColor: '#d6d3cd',
      lighting: parsed.lighting === 'night' ? 'night' : 'day',
      view: parsed.view === 'top' ? 'top' : 'iso',
      roadKind: 'road',
      selectedModule: MODULE_IDS.includes(parsed.selectedModule as ModuleId)
        ? (parsed.selectedModule as ModuleId) : 'west',
      selectedStandId: null,
      rotationSteps: typeof parsed.rotationSteps === 'number' ? parsed.rotationSteps : 0,
    };
  } catch {
    return defaultState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Parte del estadio que se puede deshacer (no la vista, selección ni iluminación). */
type Doc = Pick<AppState, 'stands' | 'exteriors' | 'environment'>;
const UNDO_LIMIT = 100;
/** Acciones seguidas en menos de este tiempo (un arrastre, un deslizador) cuentan como una sola. */
const UNDO_GROUP_MS = 600;
const undoStack: Doc[] = [];
let lastDocChange = 0;

const docOf = (s: AppState): Doc => ({ stands: s.stands, exteriors: s.exteriors, environment: s.environment });

function publish() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      stands: state.stands,
      exteriors: state.exteriors,
      environment: state.environment,
      selectedModule: state.selectedModule,
      rotationSteps: state.rotationSteps,
      lighting: state.lighting,
      view: state.view,
    }));
  } catch {
    /* almacenamiento no disponible: la sesión sigue funcionando */
  }
  listeners.forEach((l) => l());
}

function commit(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const prev = state;
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  const docChanged = prev.stands !== state.stands || prev.exteriors !== state.exteriors
    || prev.environment !== state.environment;
  if (docChanged) {
    const now = Date.now();
    if (now - lastDocChange > UNDO_GROUP_MS) {
      undoStack.push(docOf(prev));
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    }
    lastDocChange = now;
  }
  publish();
}

export const canUndo = (): boolean => undoStack.length > 0;

/** Deshace el último cambio del estadio o del entorno. */
export function undoLast() {
  const snap = undoStack.pop();
  if (!snap) return;
  lastDocChange = 0;
  state = {
    ...state,
    ...snap,
    selectedStandId: snap.stands.some((x) => x.id === state.selectedStandId) ? state.selectedStandId : null,
  };
  publish();
}

let idCounter = Date.now();
const newId = () => `s${(idCounter++).toString(36)}`;

const nextOrder = (stands: Stand[], moduleId: ModuleId) =>
  stands.filter((s) => s.moduleId === moduleId).reduce((m, s) => Math.max(m, s.order), 0) + 1;

export const actions = {
  selectModule(moduleId: ModuleId) {
    commit((s) => ({
      selectedModule: moduleId,
      selectedStandId: s.stands.some((x) => x.id === s.selectedStandId && x.moduleId === moduleId)
        ? s.selectedStandId : null,
    }));
  },

  selectStand(id: string | null) {
    commit((s) => {
      const st = id ? s.stands.find((x) => x.id === id) : undefined;
      return st ? { selectedStandId: st.id, selectedModule: st.moduleId } : { selectedStandId: null };
    });
  },

  addStand(moduleId?: ModuleId) {
    commit((s) => {
      const m = moduleId ?? s.selectedModule;
      const stand: Stand = {
        id: newId(),
        moduleId: m,
        order: nextOrder(s.stands, m),
        height: 6,
        tilt: 25,
        offset: 0,
        color: PALETTE[s.stands.length % PALETTE.length],
        railing: false,
        curve: 'straight',
        facade: { ...DEFAULT_FACADE },
      };
      return { stands: [...s.stands, stand], selectedModule: m, selectedStandId: stand.id };
    });
  },

  updateStand(id: string, patch: StandPatch) {
    commit((s) => ({
      stands: s.stands.map((st) => {
        if (st.id !== id) return st;
        const n = { ...st };
        if (patch.height !== undefined) n.height = clamp(patch.height, LIMITS.height.min, LIMITS.height.max);
        if (patch.tilt !== undefined) n.tilt = clamp(patch.tilt, LIMITS.tilt.min, LIMITS.tilt.max);
        if (patch.offset !== undefined) n.offset = clamp(patch.offset, LIMITS.offset.min, LIMITS.offset.max);
        if (patch.color !== undefined) n.color = patch.color;
        if (patch.facade !== undefined) {
          const f = sanitizeFacade(patch.facade);
          if (f) n.facade = f;
        }
        if (patch.railing !== undefined) n.railing = patch.railing;
        if (patch.curve !== undefined) n.curve = patch.curve;
        return n;
      }),
    }));
  },

  duplicateStand(id: string) {
    commit((s) => {
      const src = s.stands.find((x) => x.id === id);
      if (!src) return {};
      const copy: Stand = { ...src, id: newId(), order: nextOrder(s.stands, src.moduleId) };
      return { stands: [...s.stands, copy], selectedStandId: copy.id, selectedModule: copy.moduleId };
    });
  },

  copyStandTo(id: string, target: ModuleId) {
    commit((s) => {
      const src = s.stands.find((x) => x.id === id);
      if (!src) return {};
      const copy: Stand = { ...src, id: newId(), moduleId: target, order: nextOrder(s.stands, target) };
      return { stands: [...s.stands, copy], selectedStandId: copy.id, selectedModule: target };
    });
  },

  /** Copia una grada a todos los demás módulos, sustituyendo la grada del mismo nivel. */
  copyStandToAll(id: string) {
    commit((s) => {
      const src = s.stands.find((x) => x.id === id);
      if (!src) return {};
      const srcList = s.stands
        .filter((x) => x.moduleId === src.moduleId)
        .sort((a, b) => a.order - b.order);
      const level = srcList.findIndex((x) => x.id === src.id);

      let stands = [...s.stands];
      for (const m of MODULE_IDS) {
        if (m === src.moduleId) continue;
        const list = stands
          .filter((x) => x.moduleId === m)
          .sort((a, b) => a.order - b.order);
        const target = list[level];
        if (target) {
          stands = stands.filter((x) => x.id !== target.id);
          stands.push({ ...src, id: newId(), moduleId: m, order: target.order });
        } else {
          stands.push({ ...src, id: newId(), moduleId: m, order: nextOrder(stands, m) });
        }
      }
      const selectedStandId = stands.some((x) => x.id === s.selectedStandId) ? s.selectedStandId : null;
      return { stands, selectedStandId };
    });
  },

  removeStand(id: string) {
    commit((s) => ({
      stands: s.stands.filter((x) => x.id !== id),
      selectedStandId: s.selectedStandId === id ? null : s.selectedStandId,
    }));
  },

  setExterior(moduleId: ModuleId, patch: Partial<ModuleExterior>) {
    commit((s) => ({
      exteriors: { ...s.exteriors, [moduleId]: { ...s.exteriors[moduleId], ...sanitize(patch) } },
    }));
  },

  /** Copia solo algunos apartados (cubierta, iluminación, decoración…) a todos los módulos. */
  applyExteriorKeys(moduleId: ModuleId, keys: (keyof ModuleExterior)[]) {
    commit((s) => {
      const src = s.exteriors[moduleId];
      const exteriors = { ...s.exteriors };
      const patch: Record<string, unknown> = {};
      for (const k of keys) patch[k] = src[k];
      for (const m of MODULE_IDS) exteriors[m] = { ...s.exteriors[m], ...(patch as Partial<ModuleExterior>) };
      return { exteriors };
    });
  },

  /**
   * Aplica un cambio de grada (fachada, pilares, barandilla, color) a las gradas del mismo módulo
   * o a las del mismo nivel en todos los módulos.
   */
  applyStandPatch(id: string, patch: StandPatch, scope: 'module' | 'all') {
    commit((s) => {
      const src = s.stands.find((x) => x.id === id);
      if (!src) return {};
      const targets = new Set<string>();
      if (scope === 'module') {
        for (const st of s.stands) if (st.moduleId === src.moduleId) targets.add(st.id);
      } else {
        for (const m of MODULE_IDS) {
          const list = s.stands.filter((x) => x.moduleId === m).sort((a, b) => a.order - b.order);
          const level = s.stands
            .filter((x) => x.moduleId === src.moduleId)
            .sort((a, b) => a.order - b.order)
            .findIndex((x) => x.id === id);
          if (list[level]) targets.add(list[level].id);
        }
      }
      const stands = s.stands.map((st) => {
        if (!targets.has(st.id)) return st;
        const n = { ...st };
        if (patch.railing !== undefined) n.railing = patch.railing;
        if (patch.color !== undefined) n.color = patch.color;
        if (patch.facade !== undefined) {
          const f = sanitizeFacade(patch.facade);
          if (f) n.facade = f;
        }
        return n;
      });
      return { stands };
    });
  },

  applyExteriorToAll(moduleId: ModuleId) {
    commit((s) => {
      const src = s.exteriors[moduleId];
      const all = {} as Record<ModuleId, ModuleExterior>;
      for (const id of MODULE_IDS) all[id] = { ...src };
      return { exteriors: all };
    });
  },

  /** Sustituye el estadio actual por uno cargado (biblioteca o archivo). */
  /** Sustituye el estadio y su entorno por uno cargado (biblioteca o archivo). */
  loadProject(project: { stands: Stand[]; exteriors: Record<ModuleId, ModuleExterior>; environment?: Record<string, EnvCell> }) {
    commit({
      stands: project.stands,
      exteriors: project.exteriors,
      environment: project.environment ?? {},
      selectedStandId: null,
      selectedModule: 'west',
    });
  },


  setMode(mode: AppMode) {
    commit({ mode });
  },

  setTool(tool: EnvTool) {
    commit({ tool });
  },

  setRoadKind(kind: RoadKind) {
    commit({ roadKind: kind });
  },

  setView(view: CameraView) {
    commit({ view });
  },

  setLighting(lighting: Lighting) {
    commit({ lighting });
  },

  setBuildingKind(kind: BuildingKind) {
    commit({ buildingKind: kind });
  },

  setBuildingColor(color: string) {
    commit({ buildingColor: color });
  },

  /** Pinta la celda (i, j) con la herramienta activa. Borrar devuelve la celda a parque. */
  paintCell(i: number, j: number) {
    commit((s) => {
      const key = cellKey(i, j);
      const cur = s.environment[key];
      const env = { ...s.environment };
      switch (s.tool) {
        case 'erase':
          delete env[key];
          break;
        case 'road':
          env[key] = { type: s.roadKind };
          break;
        case 'water':
          env[key] = { type: 'water' };
          break;
        case 'tree': {
          const base: EnvCell = cur ?? { type: 'park' };
          if (base.type === 'park') env[key] = { ...base, tree: true };
          break;
        }
        case 'building':
          env[key] = {
            type: 'building',
            kind: s.buildingKind,
            height: BUILDING_HEIGHT[s.buildingKind],
            color: s.buildingColor,
          };
          break;
      }
      return { environment: env };
    });
  },

  clearEnvironment() {
    commit({ environment: {} });
  },

  rotate(delta: number = 1) {
    commit((s) => ({ rotationSteps: s.rotationSteps + delta }));
  },

  reset() {
    commit({
      stands: [],
      exteriors: defaultExteriors(),
      environment: {},
      selectedStandId: null,
      selectedModule: 'west',
      rotationSteps: 0,
    });
  },
};
