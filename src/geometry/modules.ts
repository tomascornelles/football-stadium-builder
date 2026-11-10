import * as THREE from 'three';
import { CURVE_BULGE_BY, CurveType, MODULE_IDS, ModuleExterior, ModuleId, Stand, StandFacade, TowerPos } from '../types';
import { PITCH_LENGTH, PITCH_WIDTH, ROW_RISE, STAND_GAP } from '../config';

const HALF_L = PITCH_LENGTH / 2; // 52.5 m
const HALF_W = PITCH_WIDTH / 2; // 34 m
const ARC_SEGMENTS = 32;
/** Flecha de una grada curva (m, hacia fuera). */
/** Grada elevada. */
const SLAB = 1.0;
const COLUMN = 0.9;
const COLUMN_STEP = 8;
/** Distancia por defecto de los pilares exteriores a la cara de la fachada (m, hacia fuera). */
const PILLAR_OFFSET = 0.7;
const CONCRETE = 0xb9c0c9;
const STEEL = 0xd1d5db;
const TOWER = 0x9ca3af;
/** Grosor del tablero hueco de una grada (m). */
const TABLET = 0.5;
/** Azul del marcador LED. */
const LED_BLUE = 0x0ea5e9;
/** Altura de cada tramo de escalera exterior (m). */
const STAIR_FLIGHT = 5;
/** Radio de las torres de escaleras (m). */
const TOWER_R = 5;
/** Color medio del césped, para la franja entre gradas y campo. */
const APRON_COLOR = 0x3d9243;
const RAIL_HEIGHT = 1.0;
const RAIL_THICKNESS = 0.25;
const HITBOX_DEPTH = 30;
const RING: ModuleId[] = ['north', 'ne', 'east', 'se', 'south', 'sw', 'west', 'nw'];
const CORNERS: ModuleId[] = ['nw', 'ne', 'sw', 'se'];

export const isCorner = (id: ModuleId) => CORNERS.includes(id);

/* ---------- Curvas de referencia ---------- */

/** Curva sobre la que se barre un perfil. p = punto (x, z); n = normal hacia fuera. */
export interface Frame {
  at(t: number): { p: THREE.Vector2; n: THREE.Vector2 };
  /** Tangente unitaria en el sentido del recorrido del anillo. */
  tan(t: number): THREE.Vector2;
  curved: boolean;
  length: number;
  segments: number;
}

const v2 = (x: number, z: number) => new THREE.Vector2(x, z);

/**
 * Recta o arco entre dos extremos. Con flecha > 0, el arco sale hacia fuera del campo.
 * `off` desplaza la curva hacia fuera: en un arco aumenta el radio manteniendo el centro
 * (la grada sigue siendo concéntrica con su curva base); en una recta traslada la línea.
 */
function arcFrame(a: THREE.Vector2, b: THREE.Vector2, sag: number, off: number): Frame {
  const d = b.clone().sub(a);
  const len = d.length();
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const perp = len > 1e-9 ? v2(-d.y, d.x).normalize() : v2(0, 1);
  const outward = perp.dot(mid) >= 0 ? perp : perp.clone().negate();

  if (sag < 1e-6 || len < 1e-6) {
    const a2 = a.clone().addScaledVector(outward, off);
    const b2 = b.clone().addScaledVector(outward, off);
    const dir = len > 1e-9 ? d.clone().normalize() : v2(1, 0);
    return {
      segments: 1,
      length: a2.distanceTo(b2),
      curved: false,
      at: (t) => ({ p: a2.clone().lerp(b2, t), n: outward.clone() }),
      tan: () => dir.clone(),
    };
  }

  const h = len / 2;
  const R0 = (h * h + sag * sag) / (2 * sag);
  const R = Math.max(0.5, R0 + off);
  const center = mid.clone().addScaledVector(outward, -(R0 - sag));
  const th0 = Math.atan2(a.y - center.y, a.x - center.x);
  const th1 = Math.atan2(b.y - center.y, b.x - center.x);
  let delta = th1 - th0;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const dirSign = Math.sign(delta) || 1;

  return {
    segments: ARC_SEGMENTS,
    length: Math.abs(delta) * R,
    curved: true,
    at: (t) => {
      const th = th0 + delta * t;
      const c = Math.cos(th);
      const s = Math.sin(th);
      return { p: v2(center.x + R * c, center.y + R * s), n: v2(c, s) };
    },
    tan: (t) => {
      const th = th0 + delta * t;
      return v2(-Math.sin(th), Math.cos(th)).multiplyScalar(dirSign);
    },
  };
}

/** Tamaño de cada esquina: distancia (m) desde el extremo de la banda hasta el corte de la esquina. */
const CORNER_SIZE = 24;

/**
 * Cortes entre módulos en la línea base. El módulo RING[i] va del corte i al corte i+1.
 * Cada corte es un punto de la banda; su línea de corte es radial desde el centro del campo,
 * así dos módulos vecinos con el mismo desplazamiento encajan sin huecos.
 */
const CUT_BASE: THREE.Vector2[] = (() => {
  const K = CORNER_SIZE;
  const G = STAND_GAP;
  return [
    v2(-(HALF_L - K), -(HALF_W + G)), // 0: inicio del fondo norte
    v2(HALF_L - K, -(HALF_W + G)),    // 1: fin del fondo norte
    v2(HALF_L + G, -(HALF_W - K)),    // 2: fin de la esquina noreste
    v2(HALF_L + G, HALF_W - K),       // 3: fin del lateral este
    v2(HALF_L - K, HALF_W + G),       // 4: fin de la esquina sureste
    v2(-(HALF_L - K), HALF_W + G),    // 5: fin del fondo sur
    v2(-(HALF_L + G), HALF_W - K),    // 6: fin de la esquina suroeste
    v2(-(HALF_L + G), -(HALF_W - K)), // 7: fin del lateral oeste
  ];
})();

/** Extremos de un módulo: sus dos cortes, desplazados radialmente `off` metros hacia fuera. */
function ringEnds(id: ModuleId, off: number): [THREE.Vector2, THREE.Vector2] {
  const i = RING.indexOf(id);
  const at = (k: number) => {
    const p = CUT_BASE[k % CUT_BASE.length];
    return p.clone().addScaledVector(p.clone().normalize(), off);
  };
  return [at(i), at(i + 1)];
}

/* ---------- Anclas: lo que cada módulo ofrece a sus vecinos ---------- */

export interface Anchor {
  /** Distancia de la línea de banda o de fondo a la primera fila. */
  v: number;
  /** Flecha de la curva de la primera fila (m). 0 = recta. */
  bulge: number;
}
export type Anchors = Record<ModuleId, Anchor>;

/**
 * Ancla de cada módulo recto: la grada de la primera fila (la más baja).
 * Las esquinas se ajustan a los extremos de estas anclas.
 */
export function computeAnchors(stands: Stand[]): Anchors {
  const out = {} as Anchors;
  for (const id of MODULE_IDS) out[id] = { v: STAND_GAP, bulge: 0 };
  for (const id of RING) {
    const first = stands
      .filter((s) => s.moduleId === id)
      .sort((a, b) => a.order - b.order)[0];
    if (first) out[id] = { v: STAND_GAP + first.offset, bulge: CURVE_BULGE_BY[first.curve] };
  }
  return out;
}

/** Vecinos de un módulo en el anillo. */
function neighbors(id: ModuleId): [ModuleId, ModuleId] {
  const i = RING.indexOf(id);
  return [RING[(i + RING.length - 1) % RING.length], RING[(i + 1) % RING.length]];
}

/** Curva de referencia de un módulo: la de su primera fila. */
export function moduleFrame(id: ModuleId, anchors: Anchors): Frame {
  const [a, b] = ringEnds(id, anchors[id].v - STAND_GAP);
  return arcFrame(a, b, anchors[id].bulge, 0);
}

/** Curva de una grada: su módulo (recto o curva), desplazado con sus propios extremos. */
export function standFrame(stand: Stand, _anchors: Anchors, _stands: Stand[]): Frame {
  const [a, b] = ringEnds(stand.moduleId, stand.offset);
  return arcFrame(a, b, CURVE_BULGE_BY[stand.curve as CurveType], 0);
}

/* ---------- Barrido de perfiles ---------- */

function dedupe(points: THREE.Vector2[]): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (const p of points) {
    if (out.length === 0 || out[out.length - 1].distanceTo(p) > 1e-6) out.push(p);
  }
  while (out.length > 1 && out[0].distanceTo(out[out.length - 1]) < 1e-6) out.pop();
  return out;
}

/** Tramo de una curva entre dos parámetros (para los paneles verticales). */
function subFrame(frame: Frame, a: number, b: number): Frame {
  return {
    segments: Math.max(1, Math.ceil(frame.segments * (b - a))),
    length: frame.length * (b - a),
    curved: frame.curved,
    at: (t) => frame.at(a + (b - a) * t),
    tan: (t) => frame.tan(a + (b - a) * t),
  };
}

/** Barre un perfil (u = distancia hacia fuera, y = altura) a lo largo de una curva. */
function sweepGeometry(frame: Frame, profile: THREE.Vector2[]): THREE.BufferGeometry {
  const prof = dedupe(profile);
  const N = frame.segments;
  const m = prof.length;
  const samples = [];
  for (let i = 0; i <= N; i++) samples.push(frame.at(i / N));

  const pos: number[] = [];
  for (const { p, n } of samples) {
    for (const q of prof) pos.push(p.x + n.x * q.x, q.y, p.y + n.y * q.x);
  }

  const idx = (i: number, j: number) => i * m + j;
  const index: number[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      const a = idx(i, j);
      const b = idx(i, j2);
      const c = idx(i + 1, j2);
      const d = idx(i + 1, j);
      index.push(a, b, c, a, c, d);
    }
  }
  for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(prof, [])) {
    index.push(idx(0, p), idx(0, q), idx(0, r));
    index.push(idx(N, r), idx(N, q), idx(N, p));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function sweepMesh(frame: Frame, profile: THREE.Vector2[], material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(sweepGeometry(frame, profile), material);
}

const rectPoints = (u1: number, y1: number, u2: number, y2: number) =>
  [v2(u1, y1), v2(u2, y1), v2(u2, y2), v2(u1, y2)];

/** Punto del mundo sobre la curva a una distancia u hacia fuera. */
function surface(frame: Frame, t: number, u: number): THREE.Vector3 {
  const s = frame.at(t);
  return new THREE.Vector3(s.p.x + s.n.x * u, 0, s.p.y + s.n.y * u);
}

/** Rotación Y que orienta el eje X local a lo largo de la normal. */
const faceRotation = (n: THREE.Vector2) => Math.atan2(-n.y, n.x);

function concreteMaterial() {
  return new THREE.MeshLambertMaterial({ color: CONCRETE, flatShading: true });
}

function addColumnsAlong(group: THREE.Group, frame: Frame, us: number[], height: number, mat: THREE.Material) {
  if (height <= 0) return;
  const n = Math.max(2, Math.round(frame.length / COLUMN_STEP) + 1);
  for (const u of us) {
    for (let k = 0; k < n; k++) {
      const t = 0.02 + 0.96 * (k / (n - 1));
      const p = surface(frame, t, u);
      const col = new THREE.Mesh(new THREE.BoxGeometry(COLUMN, height, COLUMN), mat);
      col.position.set(p.x, height / 2, p.z);
      col.rotation.y = faceRotation(frame.at(t).n);
      group.add(col);
    }
  }
}

/* ---------- Gradas ---------- */

/** Layout: altura base de cada grada apilada en su módulo. */
export function layoutBaseHeights(stands: Stand[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const moduleId of MODULE_IDS) {
    const sorted = stands.filter((s) => s.moduleId === moduleId).sort((a, b) => a.order - b.order);
    let base = 0;
    for (const s of sorted) {
      result.set(s.id, base);
      base += s.height;
    }
  }
  return result;
}

export function rowCount(height: number): number {
  return Math.max(2, Math.round(height / ROW_RISE));
}

/**
 * Sección de la grada en (u, y): un tablero escalonado de 0,5 m de grosor que nace en su base.
 * Pendiente real: u = altura / tan(inclinación). Por debajo queda hueco, como bajo unas escaleras.
 */
function profileUY(stand: Stand, baseY: number): { points: THREE.Vector2[]; run: number; under: THREE.Vector2[] } {
  const h = stand.height;
  const run = h / Math.tan(THREE.MathUtils.degToRad(stand.tilt));
  const rows = rowCount(h);
  const rise = h / rows;
  const tread = run / rows;

  const top: THREE.Vector2[] = [v2(0, baseY)];
  for (let i = 0; i < rows; i++) {
    const y = baseY + (i + 1) * rise;
    top.push(v2(i * tread, y));
    top.push(v2((i + 1) * tread, y));
  }
  // Cara inferior: la superior desplazada hacia abajo el grosor del tablero
  const under = top.slice().reverse().map((p) => v2(p.x, p.y - TABLET));
  return { points: [...top, ...under], run, under };
}

/** Fachada de una grada: arranca en su base, llega a su altura y su grosor es la profundidad elegida. */
function addFacade(
  group: THREE.Group, stand: Stand, frame: Frame, run: number, baseY: number, top: number,
  under: THREE.Vector2[],
) {
  const f: StandFacade = stand.facade;
  if (f.kind === 'none') return;
  const d = f.depth;
  const inner = run;
  const outer = run + d;
  const mat = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide });
  if (f.kind === 'pillars') {
    // Pilares que llegan al suelo, en el borde exterior (sin relleno bajo la grada)
    // Mismo cálculo en todos los módulos y en las esquinas: el pilar se separa de la cara exterior
    addColumnsAlong(group, frame, [outer + (f.pillarOffset ?? PILLAR_OFFSET)], top, concreteMaterial());
    return;
  }
  // Relleno del hueco bajo la grada: desde el suelo hasta su cara inferior, de u=0 a u=run
  const underAsc = under.slice().reverse(); // u creciente
  const fill = [v2(0, baseY), ...underAsc, v2(run, baseY)];
  group.add(sweepMesh(frame, fill, mat(f.color)));
  if (f.kind === 'solid') {
    group.add(sweepMesh(frame, rectPoints(inner, baseY, outer, top), mat(f.color)));
    return;
  }
  const n = Math.max(2, Math.round(f.count));
  const h = top - baseY;
  for (let k = 0; k < n; k++) {
    const color = k % 2 === 0 ? f.color : f.colorB;
    if (f.kind === 'vpanels') {
      const sub = subFrame(frame, k / n, (k + 1) / n);
      group.add(sweepMesh(sub, rectPoints(inner, baseY, outer, top), mat(color)));
    } else {
      group.add(sweepMesh(frame, rectPoints(inner, baseY + (h * k) / n, outer, baseY + (h * (k + 1)) / n), mat(color)));
    }
  }
}

/** Grupo 3D de una grada en coordenadas del mundo. */
export function buildStandGroup(stand: Stand, baseY: number, anchors: Anchors, stands: Stand[]): THREE.Group {
  const frame = standFrame(stand, anchors, stands);
  const { points, run, under } = profileUY(stand, baseY);
  const mat = new THREE.MeshLambertMaterial({ color: stand.color, flatShading: true, side: THREE.DoubleSide });
  const group = new THREE.Group();

  const tier = sweepMesh(frame, points, mat);
  tier.userData.isTier = true;
  group.add(tier);

  // Pilares: solo bajo el tablero, desde el suelo hasta su cara inferior
  const colH = baseY - TABLET;
  if (colH > 0 && stand.columns !== 'none') {
    const us: number[] = stand.columns === 'inner' ? [0.8] : [run - 0.8];
    addColumnsAlong(group, frame, us, colH, concreteMaterial());
  }
  addFacade(group, stand, frame, run, baseY, baseY + stand.height, under);
  if (stand.railing) {
    const rail = new THREE.MeshLambertMaterial({ color: STEEL, flatShading: true, side: THREE.DoubleSide });
    group.add(sweepMesh(frame, rectPoints(-RAIL_THICKNESS, baseY, 0, baseY + RAIL_HEIGHT), rail));
  }

  group.userData.standId = stand.id;
  group.userData.moduleId = stand.moduleId;
  return group;
}

export interface ModuleExtent {
  front: number;
  /** Borde trasero, medido desde la curva de referencia del módulo. */
  back: number;
  /** Borde exterior incluyendo las fachadas. */
  outer: number;
  top: number;
}

/** Extensión de las gradas de un módulo respecto a su curva de referencia. */
export function moduleExtent(stands: Stand[], moduleId: ModuleId): ModuleExtent | null {
  const list = stands.filter((s) => s.moduleId === moduleId);
  if (list.length === 0) return null;
  const anchors = computeAnchors(stands);
  const bases = layoutBaseHeights(list);
  let back = -Infinity;
  let outer = -Infinity;
  let top = 0;
  for (const s of list) {
    const rel = STAND_GAP + s.offset - anchors[moduleId].v;
    const run = s.height / Math.tan(THREE.MathUtils.degToRad(s.tilt));
    const facadeDepth = s.facade.kind === 'none' ? 0 : s.facade.depth;
    back = Math.max(back, rel + run);
    outer = Math.max(outer, rel + run + facadeDepth);
    top = Math.max(top, (bases.get(s.id) ?? 0) + s.height);
  }
  return { front: 0, back, outer, top };
}

function resolveExtent(extent: ModuleExtent | null): ModuleExtent {
  return extent ?? { front: 0, back: 10, outer: 10, top: 0 };
}

/* ---------- Exteriores ---------- */

/** Exteriores de un módulo: fachada, cubierta, focos y marcador. */
export function buildModuleStructures(
  moduleId: ModuleId,
  ext: ModuleExterior,
  extent: ModuleExtent | null,
  anchors: Anchors,
  tallest: Tallest | null,
): THREE.Group {
  const frame = moduleFrame(moduleId, anchors);
  const group = new THREE.Group();
  const ex = resolveExtent(extent);

  if (ext.roof !== 'none' && extent && tallest) {
    // La cubierta sigue la curva en planta de la grada más alta, pero es horizontal:
    // va a la altura de su borde superior más la holgura elegida
    const tFrame = tallest.frame;
    const { run } = profileUY(tallest.stand, tallest.base);
    // Va desde el interior (u negativo, sobre el campo) hasta el borde trasero
    const L = ext.roofWidth > 0 ? ext.roofWidth : run + ext.roofOverhang;
    const u0 = -ext.roofInset;
    const span = L - u0;
    const T = ext.roofThickness;
    // Voladizo inclinado: la altura cambia linealmente desde el borde interior (positivo = sube hacia fuera)
    const slope = ext.roof === 'cantilever' ? Math.tan(THREE.MathUtils.degToRad(ext.roofAngle)) : 0;
    const yb = (u: number) => tallest.base + tallest.stand.height + ext.roofHeight + slope * (u - u0);
    // La cubierta curva se abomba en el centro, según su parámetro de flecha
    const bump = (u: number) => (ext.roof === 'arch' ? ext.roofSlope * 0.3 * Math.sin((Math.PI * (u - u0)) / span) : 0);
    const steps = ext.roof === 'arch' ? 12 : 1;
    const bottom: THREE.Vector2[] = [];
    const top: THREE.Vector2[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = u0 + (span * i) / steps;
      const y = yb(u) + bump(u);
      bottom.push(v2(u, y));
      top.push(v2(u, y + T));
    }
    const roofMat = new THREE.MeshLambertMaterial({ color: ext.roofColor, flatShading: true, side: THREE.DoubleSide });
    group.add(sweepMesh(tFrame, [...bottom, ...top.reverse()], roofMat));
    if (ext.roofColumns) {
      addColumnsAlong(group, tFrame, [L - 0.8], yb(L - 0.8), concreteMaterial());
      if (ext.roof !== 'canopy') addColumnsAlong(group, tFrame, [u0 + 0.8], yb(u0 + 0.8), concreteMaterial());
    }
    // Fanal de la marquesina: bajo el borde delantero, apuntando al centro (se enciende de noche)
    const lampY = tallest.base + tallest.stand.height + ext.roofHeight - 0.3;
    const lampP = surface(tFrame, 0.5, u0 + 1);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.4, 1.5),
      new THREE.MeshBasicMaterial({ color: 0xfff3d1 }),
    );
    lamp.position.set(lampP.x, lampY, lampP.z);
    lamp.rotation.y = faceRotation(tFrame.at(0.5).n);
    lamp.userData.roofLight = true;
    lamp.userData.lightColor = '#fff3d1';
    group.add(lamp);
    // Marcador de marquesina: pantalla LED azul bajo el borde delantero, a lo ancho de la cubierta
    if (ext.score === 'marquesina') {
      const top = yb(0) - 0.4;
      group.add(sweepMesh(tFrame, roundedRectPoints(u0 + 0.2, top - 3.2, u0 + 1.2, top, 0.4), new THREE.MeshBasicMaterial({ color: LED_BLUE })));
    }
    // Barra de luz: solo con cubierta, en el borde interior, como pieza metálica (no emite)
    if (ext.flood === 'bar') {
      group.add(sweepMesh(tFrame, rectPoints(u0 + 0.2, yb(0) - 0.9, u0 + 1.2, yb(0) - 0.1), new THREE.MeshLambertMaterial({ color: 0x9ca3af, flatShading: true })));
    }
    if (ext.roofDeco !== 'none') {
      const decoMat = new THREE.MeshLambertMaterial({ color: ext.roofDecoColor, flatShading: true });
      addRoofDecoration(group, tFrame, u0, L, yb(0), T, ext, decoMat);
    }
  }

  if (ext.flood === 'mast') {
    const towerU = ex.outer + 2;
    const h = ext.floodHeight;
    const steel = new THREE.MeshLambertMaterial({ color: TOWER, flatShading: true });
    const lightMat = new THREE.MeshBasicMaterial({ color: ext.floodColor });
    const towers = ext.floodCount;
    for (let k = 0; k < towers; k++) {
      const t = (k + 0.5) / towers;
      const p = surface(frame, t, towerU);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), steel);
      tower.position.set(p.x, h / 2, p.z);
      group.add(tower);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 6), lightMat);
      head.position.set(p.x, h, p.z);
      head.rotation.y = faceRotation(frame.at(t).n);
      // Marca el cabezal como foco: de noche emite luz puntual
      head.userData.floodHead = true;
      head.userData.lightColor = ext.floodColor;
      group.add(head);
    }
  }

  if (ext.score === 'marcador' || ext.score === 'pantalla') {
    const u = Math.max(0.5, ex.back - 1.5);
    const w = ext.scoreWidth;
    const boardY = ex.top + ext.scoreHeight;
    const boardBottom = Math.max(0.5, boardY - (w * 0.5) / 2);
    const p = surface(frame, 0.5, u);
    const rot = faceRotation(frame.at(0.5).n);
    const steel = new THREE.MeshLambertMaterial({ color: TOWER, flatShading: true });
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.6, boardBottom, 0.6), steel);
    pole.position.set(p.x, boardBottom / 2, p.z);
    group.add(pole);

    const boardMat = new THREE.MeshBasicMaterial({ color: ext.score === 'marcador' ? 0x0f172a : 0x0ea5e9 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, w * 0.5, w), boardMat);
    board.position.set(p.x, boardY, p.z);
    board.rotation.y = rot;
    group.add(board);

    if (ext.score === 'marcador') {
      const frameMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, w * 0.5 + 0.8, w + 0.8),
        new THREE.MeshLambertMaterial({ color: STEEL, flatShading: true }),
      );
      const n = frame.at(0.5).n;
      frameMesh.position.set(p.x + n.x * 0.6, boardY, p.z + n.y * 0.6);
      frameMesh.rotation.y = rot;
      group.add(frameMesh);
    }
  }
  if (ext.deco !== 'none') addDecoration(group, moduleId, ext, frame, ex, extent);
  if (ext.stairs && extent) addStairs(group, frame, ex, isCorner(moduleId) ? 1 : 3);
  if (ext.circleTowers > 0 && extent) addCircleTowers(group, frame, ext, ex);
  return group;
}

/** Prisma sólido de 8 vértices: cara superior a[0..3], cara inferior b[0..3] (mismo orden). */
function prismMesh(a: THREE.Vector3[], b: THREE.Vector3[], material: THREE.Material): THREE.Mesh {
  const faces = [
    [a[0], a[1], a[2], a[3]],
    [b[3], b[2], b[1], b[0]],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push([a[i], a[j], b[j], b[i]]);
  }
  const pos: number[] = [];
  for (const f of faces) {
    const [p0, p1, p2, p3] = f;
    for (const p of [p0, p1, p2, p0, p2, p3]) pos.push(p.x, p.y, p.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * Escaleras exteriores: rampas planas en zigzag por la fachada, con tramos de 5 m.
 * Cada tramo es una losa inclinada con barandilla a cada lado; los tramos se encadenan
 * alternando el sentido, de modo que la rampa de un tramo parte donde termina la anterior.
 */
function addStairs(group: THREE.Group, frame: Frame, ex: ModuleExtent, count: number) {
  const top = ex.top;
  if (top <= 0) return;
  const mat = new THREE.MeshLambertMaterial({ color: STEEL, flatShading: true, side: THREE.DoubleSide });
  const u = ex.outer + 0.3;
  const W = 1.2;
  const THICK = 0.4;
  const flights = Math.max(1, Math.ceil(top / STAIR_FLIGHT));
  for (let s = 0; s < count; s++) {
    const a0 = s / count + 0.04;
    const a1 = (s + 1) / count - 0.04;
    for (let f = 0; f < flights; f++) {
      const y0 = f * STAIR_FLIGHT;
      const y1 = Math.min(top, y0 + STAIR_FLIGHT);
      const fromStart = f % 2 === 0;
      const tS = fromStart ? a0 : a1;
      const tE = fromStart ? a1 : a0;
      // Losa plana inclinada: cuatro esquinas en la cara superior y otras cuatro bajo ella
      const top4 = [
        pointAt(frame, tS, u - W, y0), pointAt(frame, tS, u + W, y0),
        pointAt(frame, tE, u + W, y1), pointAt(frame, tE, u - W, y1),
      ];
      const bot4 = top4.map((p) => p.clone().setY(p.y - THICK));
      group.add(prismMesh(top4, bot4, mat));
      // Barandillas a ambos lados, siguiendo la pendiente
      const rail = 1.0;
      for (const side of [-W, W]) {
        addSegment(group,
          pointAt(frame, tS, u + side, y0 + rail), pointAt(frame, tE, u + side, y1 + rail), 0.2, mat);
      }
    }
  }
}

/** Torres de escaleras adjuntas a la fachada: huecas, gruesas y sin techo. */
function addCircleTowers(group: THREE.Group, frame: Frame, ext: ModuleExterior, ex: ModuleExtent) {
  const n = ext.circleTowers;
  const h = ext.circleTowerHeight;
  const wall = new THREE.MeshLambertMaterial({ color: ext.circleTowerColor, flatShading: true, side: THREE.DoubleSide });
  const posT: Record<TowerPos, number> = { left: 0.14, center: 0.5, right: 0.86 };
  const ts = n === 1 ? [posT[ext.circleTowerPos]] : Array.from({ length: n }, (_, k) => (k + 0.5) / n);
  const WALL = 1.2;
  for (const t of ts) {
    const p = surface(frame, t, ex.outer + TOWER_R);
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(TOWER_R, TOWER_R, h, 24, 1, true), wall);
    outer.position.set(p.x, h / 2, p.z);
    group.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(TOWER_R - WALL, TOWER_R - WALL, h, 24, 1, true), wall);
    inner.position.set(p.x, h / 2, p.z);
    group.add(inner);
    const rim = new THREE.Mesh(new THREE.RingGeometry(TOWER_R - WALL, TOWER_R, 24), wall);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(p.x, h, p.z);
    group.add(rim);
  }
}

/** Segmento recto entre dos puntos del mundo. */
function addSegment(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, thick: number, mat: THREE.Material) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-6) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, thick, thick), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  group.add(m);
}

/**
 * Decoración exterior: pilares, torres, soportes de cubierta y arcos.
 * Las posiciones se reparten a lo largo del módulo.
 */
function addDecoration(
  group: THREE.Group,
  moduleId: ModuleId,
  ext: ModuleExterior,
  frame: Frame,
  ex: ModuleExtent,
  extent: ModuleExtent | null,
) {
  const mat = new THREE.MeshLambertMaterial({ color: ext.decoColor, flatShading: true });
  const count = Math.max(1, ext.decoCount);
  const ts = Array.from({ length: count }, (_, k) => (k + 0.5) / count);
  const outerU = ex.outer + 1;
  const h = ext.decoHeight;
  const roofY = ex.top + ext.roofHeight;

  switch (ext.deco) {
    case 'pillars': {
      for (const t of ts) {
        const p = surface(frame, t, outerU);
        const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), mat);
        col.position.set(p.x, h / 2, p.z);
        col.rotation.y = faceRotation(frame.at(t).n);
        group.add(col);
      }
      break;
    }
    case 'towers': {
      const positions = ts;
      for (const t of positions) {
        const p = surface(frame, t, outerU + 2.5);
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(5, h, 5), mat);
        shaft.position.set(p.x, h / 2, p.z);
        shaft.rotation.y = faceRotation(frame.at(t).n);
        group.add(shaft);
        const crown = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 6), mat);
        crown.position.set(p.x, h + 0.75, p.z);
        crown.rotation.y = faceRotation(frame.at(t).n);
        group.add(crown);
      }
      break;
    }
    case 'struts': {
      if (!extent || ext.roof === 'none') break;
      const innerU = ex.back + ext.roofOverhang - 2;
      for (const t of ts) {
        const a = surface(frame, t, outerU);
        a.y = 0;
        const b = surface(frame, t, innerU);
        b.y = roofY;
        addSegment(group, a, b, 0.8, mat);
      }
      break;
    }
    case 'arches': {
      // Arcos en el plano de la fachada, abiertos hacia el exterior
      const R = h / 2;
      const L = frame.length;
      const steps = 14;
      for (const t of ts) {
        if (t - R / L < 0 || t + R / L > 1) continue;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= steps; i++) {
          const th = (Math.PI * i) / steps;
          const tt = t + (R * Math.cos(th)) / L;
          pts.push(pointAt(frame, tt, outerU, R * Math.sin(th)));
        }
        for (let i = 0; i < steps; i++) addSegment(group, pts[i], pts[i + 1], 1.2, mat);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Decoración sobre la cubierta: armaduras, mástiles con tirantes o viga de coronación.
 * roofY es la base de la cubierta; la superficie superior queda en roofY + T.
 */
function addRoofDecoration(
  group: THREE.Group,
  frame: Frame,
  u0: number,
  L: number,
  roofY: number,
  T: number,
  ext: ModuleExterior,
  mat: THREE.Material,
) {
  const top = roofY + T;
  const count = Math.max(1, ext.roofDecoCount);
  const ts = Array.from({ length: count }, (_, k) => (k + 0.5) / count);
  const H = ext.roofDecoHeight;

  switch (ext.roofDeco) {
    case 'lattice': {
      // Celosía: dos cordones longitudinales con postes, diagonales y cruces transversales
      const panels = count;
      for (const u of [u0, L]) {
        for (let k = 0; k < panels; k++) {
          const t0 = k / panels;
          const t1 = (k + 1) / panels;
          addSegment(group, pointAt(frame, t0, u, top + H), pointAt(frame, t1, u, top + H), 0.6, mat);
          addSegment(group, pointAt(frame, t0, u, top), pointAt(frame, t0, u, top + H), 0.5, mat);
          addSegment(group, pointAt(frame, t0, u, top), pointAt(frame, t1, u, top + H), 0.4, mat);
        }
        addSegment(group, pointAt(frame, 1, u, top), pointAt(frame, 1, u, top + H), 0.5, mat);
      }
      for (let k = 0; k <= panels; k++) {
        const t = k / panels;
        addSegment(group, pointAt(frame, t, u0, top + H), pointAt(frame, t, L, top + H), 0.4, mat);
      }
      break;
    }
    case 'trusses': {
      // Arco de acero en el plano transversal, con cuerda inferior y montantes
      const steps = 10;
      const c = (u0 + L) / 2;
      const r = (L - u0) / 2;
      for (const t of ts) {
        addSegment(group, pointAt(frame, t, u0, top), pointAt(frame, t, L, top), 0.8, mat);
        const arc: THREE.Vector3[] = [];
        for (let i = 0; i <= steps; i++) {
          const th = (Math.PI * i) / steps;
          arc.push(pointAt(frame, t, c - r * Math.cos(th), top + H * Math.sin(th)));
        }
        for (let i = 0; i < steps; i++) addSegment(group, arc[i], arc[i + 1], 0.8, mat);
        for (let i = 2; i < steps - 1; i += 2) {
          const foot = pointAt(frame, t, c - r * Math.cos((Math.PI * i) / steps), top);
          addSegment(group, arc[i], foot, 0.5, mat);
        }
      }
      break;
    }
    case 'masts': {
      // Mástiles en el borde trasero, con tirantes hasta el borde de la cubierta
      for (const t of ts) {
        const base = pointAt(frame, t, L - 1, top);
        const tip = pointAt(frame, t, L - 1, top + H);
        addSegment(group, base, tip, 0.7, mat);
        addSegment(group, tip, pointAt(frame, t, u0, top), 0.2, mat);
        addSegment(group, tip, pointAt(frame, t, L, top), 0.2, mat);
      }
      break;
    }
    default:
      break;
  }
}

/** Rectángulo con las cuatro esquinas redondeadas, en el plano (u, y). */
function roundedRectPoints(u1: number, y1: number, u2: number, y2: number, r: number, seg = 5): THREE.Vector2[] {
  const corners: [number, number, number][] = [
    [u2 - r, y2 - r, 0],
    [u1 + r, y2 - r, Math.PI / 2],
    [u1 + r, y1 + r, Math.PI],
    [u2 - r, y1 + r, (3 * Math.PI) / 2],
  ];
  const pts: THREE.Vector2[] = [];
  for (const [cu, cy, a0] of corners) {
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (Math.PI / 2) * (k / seg);
      pts.push(v2(cu + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  }
  return pts;
}

/** Punto del mundo a una distancia u y una altura y sobre la curva. */
function pointAt(frame: Frame, t: number, u: number, y: number): THREE.Vector3 {
  const p = surface(frame, t, u);
  p.y = y;
  return p;
}

/** Césped entre las gradas y el campo: polígono formado por las curvas frontales de los módulos. */
export function buildApron(anchors: Anchors): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  for (const id of RING) {
    const f = moduleFrame(id, anchors);
    for (let i = 0; i < f.segments; i++) pts.push(f.at(i / f.segments).p.clone());
  }
  const poly = dedupe(pts);
  const tris = THREE.ShapeUtils.triangulateShape(poly, []);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(poly.flatMap((p) => [p.x, 0, p.y]), 3));
  geo.setIndex(tris.flat());
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: APRON_COLOR, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.02;
  return mesh;
}

/** Grada más alta de un módulo, con su altura base. */
export interface Tallest {
  stand: Stand;
  base: number;
  frame: Frame;
}

export function tallestStand(stands: Stand[], moduleId: ModuleId, anchors: Anchors): Tallest | null {
  const bases = layoutBaseHeights(stands);
  let best: { stand: Stand; base: number; top: number } | null = null;
  for (const st of stands) {
    if (st.moduleId !== moduleId) continue;
    const base = bases.get(st.id) ?? 0;
    const top = base + st.height;
    if (!best || top > best.top) best = { stand: st, base, top };
  }
  return best ? { stand: best.stand, base: best.base, frame: standFrame(best.stand, anchors, stands) } : null;
}

/** Zona de selección de un módulo, siguiendo su curva. */
export function hitboxMesh(moduleId: ModuleId, anchors: Anchors): THREE.Mesh {
  const frame = moduleFrame(moduleId, anchors);
  const material = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(sweepGeometry(frame, rectPoints(0, 0.05, HITBOX_DEPTH, 0.1)), material);
  mesh.userData.moduleId = moduleId;
  return mesh;
}
