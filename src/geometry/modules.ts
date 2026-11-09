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
const CONCRETE = 0xb9c0c9;
const STEEL = 0xd1d5db;
const TOWER = 0x9ca3af;
/** Grosor de la tableta de una grada sin fachada (m). */
const TABLET = 0.5;
/** Grosor de la fachada de una grada (m). */
const FACADE_T = 1.0;
/** Altura de cada tramo de escalera exterior (m). */
const STAIR_FLIGHT = 5;
/** Radio de las torres circulares adjuntas (m). */
const TOWER_R = 4;
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

/** Línea recta o arco entre dos extremos, con flecha hacia fuera del campo. */
function buildFrame(a: THREE.Vector2, b: THREE.Vector2, sag: number): Frame {
  const d = b.clone().sub(a);
  const len = d.length();
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const perp = len > 1e-9 ? v2(-d.y, d.x).normalize() : v2(0, 1);
  const outward = perp.dot(mid) >= 0 ? perp : perp.clone().negate();

  if (sag < 1e-6 || len < 1e-6) {
    const dir = len > 1e-9 ? d.clone().normalize() : v2(1, 0);
    return {
      segments: 1,
      length: len,
      curved: false,
      at: (t) => ({ p: a.clone().lerp(b, t), n: outward.clone() }),
      tan: () => dir.clone(),
    };
  }

  const h = len / 2;
  const R = (h * h + sag * sag) / (2 * sag);
  const center = mid.clone().addScaledVector(outward, -(R - sag));
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

/** Curva de Bézier cúbica. Se usa para las esquinas, que empiezan y acaban con la tangente de sus vecinas. */
function bezierFrame(P0: THREE.Vector2, P1: THREE.Vector2, P2: THREE.Vector2, P3: THREE.Vector2, curved: boolean): Frame {
  const point = (t: number) => {
    const u = 1 - t;
    return P0.clone().multiplyScalar(u * u * u)
      .addScaledVector(P1, 3 * u * u * t)
      .addScaledVector(P2, 3 * u * t * t)
      .addScaledVector(P3, t * t * t);
  };
  const deriv = (t: number) => {
    const u = 1 - t;
    return P1.clone().sub(P0).multiplyScalar(3 * u * u)
      .addScaledVector(P2.clone().sub(P1), 6 * u * t)
      .addScaledVector(P3.clone().sub(P2), 3 * t * t);
  };
  const mid = point(0.5);
  const dm = deriv(0.5);
  const sign = v2(-dm.y, dm.x).dot(mid) >= 0 ? 1 : -1;

  let length = 0;
  let prev = P0;
  for (let i = 1; i <= ARC_SEGMENTS; i++) {
    const q = point(i / ARC_SEGMENTS);
    length += prev.distanceTo(q);
    prev = q;
  }

  return {
    segments: ARC_SEGMENTS,
    length,
    curved,
    at: (t) => {
      const d = deriv(t).normalize();
      return { p: point(t), n: v2(-d.y, d.x).multiplyScalar(sign) };
    },
    tan: (t) => deriv(t).normalize(),
  };
}

/** Extremos de un módulo recto, a una distancia v de la línea de banda o de fondo. */
function straightEnds(id: ModuleId, v: number): [THREE.Vector2, THREE.Vector2] {
  switch (id) {
    case 'north': return [v2(-HALF_L, -(HALF_W + v)), v2(HALF_L, -(HALF_W + v))];
    case 'east': return [v2(HALF_L + v, -HALF_W), v2(HALF_L + v, HALF_W)];
    case 'south': return [v2(HALF_L, HALF_W + v), v2(-HALF_L, HALF_W + v)];
    case 'west': return [v2(-(HALF_L + v), HALF_W), v2(-(HALF_L + v), -HALF_W)];
    default: return [v2(0, 0), v2(0, 0)];
  }
}

/**
 * Plantillas de esquina según la curvatura de los vecinos:
 * - recta: ambos vecinos rectos, cuarto de circunferencia.
 * - curva: ambos vecinos curvos.
 * - mixta: un vecino recto y otro curvo.
 */
export type CornerTemplate = 'straight' | 'curved' | 'mixed';

const CORNER_HANDLE: Record<CornerTemplate, number> = {
  straight: 0.39,
  curved: 0.44,
  mixed: 0.41,
};

export const CORNER_TEMPLATE_LABEL: Record<CornerTemplate, string> = {
  straight: 'recta',
  curved: 'curva',
  mixed: 'mixta',
};

export function cornerTemplate(prevCurved: boolean, nextCurved: boolean): CornerTemplate {
  if (prevCurved && nextCurved) return 'curved';
  if (!prevCurved && !nextCurved) return 'straight';
  return 'mixed';
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
    if (isCorner(id)) continue;
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

/** Esquina: une el extremo del vecino anterior con el inicio del siguiente, con sus tangentes. */
function cornerFrame(id: ModuleId, anchors: Anchors): Frame {
  const [prev, next] = neighbors(id);
  const pf = moduleFrame(prev, anchors);
  const nf = moduleFrame(next, anchors);
  const A = pf.at(1).p;
  const tA = pf.tan(1);
  const B = nf.at(0).p;
  const tB = nf.tan(0);
  const k = CORNER_HANDLE[cornerTemplate(pf.curved, nf.curved)] * A.distanceTo(B);
  const P1 = A.clone().addScaledVector(tA, k);
  const P2 = B.clone().addScaledVector(tB, -k);
  return bezierFrame(A, P1, P2, B, true);
}

/** Curva de referencia de un módulo (la de su ancla). */
export function moduleFrame(id: ModuleId, anchors: Anchors): Frame {
  if (isCorner(id)) return cornerFrame(id, anchors);
  const [a, b] = straightEnds(id, anchors[id].v);
  return buildFrame(a, b, anchors[id].bulge);
}

/** Plantilla que usa una esquina según sus vecinos. */
export function cornerTemplateOf(id: ModuleId, anchors: Anchors): CornerTemplate {
  const [prev, next] = neighbors(id);
  return cornerTemplate(anchors[prev].bulge > 0, anchors[next].bulge > 0);
}

/** Curva desplazada una distancia hacia fuera a lo largo de su normal. */
function offsetFrame(frame: Frame, off: number): Frame {
  if (Math.abs(off) < 1e-6) return frame;
  return {
    segments: frame.segments,
    length: frame.length,
    curved: frame.curved,
    at: (t) => {
      const s = frame.at(t);
      return { p: s.p.clone().addScaledVector(s.n, off), n: s.n };
    },
    tan: frame.tan,
  };
}

/** Fila de una grada dentro de su módulo (0 = la más baja). */
function rankOf(stand: Stand, stands: Stand[]): number {
  const list = stands.filter((s) => s.moduleId === stand.moduleId).sort((a, b) => a.order - b.order);
  return Math.max(0, list.findIndex((s) => s.id === stand.id));
}

/** Curva de una fila de un módulo vecino: la del mismo nivel, o la más alta que tenga. */
function neighborFrame(id: ModuleId, rank: number, stands: Stand[], anchors: Anchors): Frame {
  const list = stands.filter((s) => s.moduleId === id).sort((a, b) => a.order - b.order);
  if (list.length === 0) return moduleFrame(id, anchors);
  return standFrame(list[Math.min(rank, list.length - 1)], anchors, stands);
}

/**
 * Desplazamiento propio de una esquina respecto al de sus vecinos del mismo nivel.
 * Si la esquina tiene el mismo desplazamiento que sus vecinos, no se suma nada.
 */
export function cornerExtraOffset(stand: Stand, stands: Stand[]): number {
  const [prev, next] = neighbors(stand.moduleId);
  const rank = rankOf(stand, stands);
  const offAt = (id: ModuleId) => {
    const list = stands.filter((s) => s.moduleId === id).sort((a, b) => a.order - b.order);
    return list.length === 0 ? 0 : list[Math.min(rank, list.length - 1)].offset;
  };
  return stand.offset - (offAt(prev) + offAt(next)) / 2;
}

/**
 * Curva de una grada. En las esquinas, cada fila se une a la fila del mismo nivel de los vecinos,
 * así las tribunas superiores también encajan.
 */
export function standFrame(stand: Stand, anchors: Anchors, stands: Stand[]): Frame {
  if (isCorner(stand.moduleId)) {
    const [prev, next] = neighbors(stand.moduleId);
    const rank = rankOf(stand, stands);
    const pf = neighborFrame(prev, rank, stands, anchors);
    const nf = neighborFrame(next, rank, stands, anchors);
    const A = pf.at(1).p;
    const tA = pf.tan(1);
    const B = nf.at(0).p;
    const tB = nf.tan(0);
    const k = CORNER_HANDLE[cornerTemplate(pf.curved, nf.curved)] * A.distanceTo(B);
    const P1 = A.clone().addScaledVector(tA, k);
    const P2 = B.clone().addScaledVector(tB, -k);
    return offsetFrame(bezierFrame(A, P1, P2, B, true), cornerExtraOffset(stand, stands));
  }
  const [a, b] = straightEnds(stand.moduleId, STAND_GAP + stand.offset);
  return buildFrame(a, b, CURVE_BULGE_BY[stand.curve as CurveType]);
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

/** Altura inferior del cuerpo de la grada. Sin fachada es una tableta de 0,5 m. */
function standBottom(stand: Stand, baseY: number): number {
  const noFacade = stand.facade.kind === 'none';
  if (!noFacade && baseY <= 0) return 0;
  return baseY - (noFacade ? TABLET : SLAB);
}

/** Sección de la grada en (u, y). Pendiente real: u = altura / tan(inclinación). */
function profileUY(stand: Stand, baseY: number): { points: THREE.Vector2[]; run: number } {
  const h = stand.height;
  const run = h / Math.tan(THREE.MathUtils.degToRad(stand.tilt));
  const rows = rowCount(h);
  const rise = h / rows;
  const tread = run / rows;
  const bottom = standBottom(stand, baseY);

  const points: THREE.Vector2[] = [v2(0, bottom), v2(0, baseY)];
  for (let i = 0; i < rows; i++) {
    const y = baseY + (i + 1) * rise;
    points.push(v2(i * tread, y));
    points.push(v2((i + 1) * tread, y));
  }
  points.push(v2(run, bottom));
  return { points, run };
}

/** Fachada de una grada: sigue su curva y su altura, a la profundidad elegida desde su borde trasero. */
function addFacade(group: THREE.Group, stand: Stand, frame: Frame, run: number, top: number) {
  const f: StandFacade = stand.facade;
  if (f.kind === 'none') return;
  const outer = run + f.depth;
  const mat = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide });
  if (f.kind === 'pillars') {
    addColumnsAlong(group, frame, [outer + 0.6], top, concreteMaterial());
    return;
  }
  if (f.kind === 'solid') {
    group.add(sweepMesh(frame, rectPoints(outer, 0, outer + FACADE_T, top), mat(f.color)));
    return;
  }
  const n = Math.max(2, Math.round(f.count));
  for (let k = 0; k < n; k++) {
    const color = k % 2 === 0 ? f.color : f.colorB;
    if (f.kind === 'vpanels') {
      const sub = subFrame(frame, k / n, (k + 1) / n);
      group.add(sweepMesh(sub, rectPoints(outer, 0, outer + FACADE_T, top), mat(color)));
    } else {
      group.add(sweepMesh(frame, rectPoints(outer, (top * k) / n, outer + FACADE_T, (top * (k + 1)) / n), mat(color)));
    }
  }
}

/** Grupo 3D de una grada en coordenadas del mundo. */
export function buildStandGroup(stand: Stand, baseY: number, anchors: Anchors, stands: Stand[]): THREE.Group {
  const frame = standFrame(stand, anchors, stands);
  const { points, run } = profileUY(stand, baseY);
  const mat = new THREE.MeshLambertMaterial({ color: stand.color, flatShading: true, side: THREE.DoubleSide });
  const group = new THREE.Group();

  const tier = sweepMesh(frame, points, mat);
  tier.userData.isTier = true;
  group.add(tier);

  const colH = standBottom(stand, baseY);
  if (colH > 0 && stand.columns !== 'none') {
    const us: number[] = stand.columns === 'inner' ? [0.8] : [run - 0.8];
    addColumnsAlong(group, frame, us, colH, concreteMaterial());
  }
  addFacade(group, stand, frame, run, baseY + stand.height);
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
    const rel = isCorner(moduleId) ? cornerExtraOffset(s, stands) : STAND_GAP + s.offset - anchors[moduleId].v;
    const run = s.height / Math.tan(THREE.MathUtils.degToRad(s.tilt));
    const facadeDepth = s.facade.kind === 'none' ? 0 : s.facade.depth + FACADE_T;
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
    // Marcador de marquesina: panel colgado bajo el borde delantero, con marco
    if (ext.roofScore) {
      const bu = u0 + 1.2;
      const bp = surface(tFrame, 0.5, bu);
      const rot = faceRotation(tFrame.at(0.5).n);
      const by = yb(0) - 3.1;
      const frameMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 5.8, 15.6),
        new THREE.MeshBasicMaterial({ color: 0xe8dcc4 }),
      );
      frameMesh.position.set(bp.x, by, bp.z);
      frameMesh.rotation.y = rot;
      group.add(frameMesh);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 5, 14),
        new THREE.MeshBasicMaterial({ color: 0x0a2e38 }),
      );
      board.position.set(bp.x + tFrame.at(0.5).n.x * 0.2, by, bp.z + tFrame.at(0.5).n.y * 0.2);
      board.rotation.y = rot;
      group.add(board);
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

  if (ext.score !== 'none') {
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

/** Escaleras exteriores en zigzag por la fachada, con tramos de 5 m. */
function addStairs(group: THREE.Group, frame: Frame, ex: ModuleExtent, count: number) {
  const top = ex.top;
  if (top <= 0) return;
  const mat = new THREE.MeshLambertMaterial({ color: STEEL, flatShading: true });
  const u = ex.outer + 2;
  const flights = Math.max(1, Math.ceil(top / STAIR_FLIGHT));
  for (let s = 0; s < count; s++) {
    const a0 = s / count + 0.04;
    const a1 = (s + 1) / count - 0.04;
    for (let f = 0; f < flights; f++) {
      const y0 = f * STAIR_FLIGHT;
      const y1 = Math.min(top, y0 + STAIR_FLIGHT);
      const fromStart = f % 2 === 0;
      const tStart = fromStart ? a0 : a1;
      const tEnd = fromStart ? a1 : a0;
      addSegment(group, pointAt(frame, tStart, u, y0), pointAt(frame, tEnd, u, y1), 0.5, mat);
      const steps = 8;
      for (let k = 0; k <= steps; k++) {
        const r = k / steps;
        const t = tStart + (tEnd - tStart) * r;
        const y = y0 + (y1 - y0) * r;
        addSegment(group, pointAt(frame, t, u - 1.2, y), pointAt(frame, t, u + 1.2, y), 0.25, mat);
      }
    }
  }
}

/** Torres circulares adjuntas a la fachada. Con una sola, se elige izquierda, centro o derecha. */
function addCircleTowers(group: THREE.Group, frame: Frame, ext: ModuleExterior, ex: ModuleExtent) {
  const n = ext.circleTowers;
  const h = ext.circleTowerHeight;
  const body = new THREE.MeshLambertMaterial({ color: ext.circleTowerColor, flatShading: true });
  const cap = new THREE.MeshLambertMaterial({ color: TOWER, flatShading: true });
  const posT: Record<TowerPos, number> = { left: 0.14, center: 0.5, right: 0.86 };
  const ts = n === 1 ? [posT[ext.circleTowerPos]] : Array.from({ length: n }, (_, k) => (k + 0.5) / n);
  for (const t of ts) {
    const p = surface(frame, t, ex.outer + TOWER_R);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(TOWER_R, TOWER_R, h, 20), body);
    shaft.position.set(p.x, h / 2, p.z);
    group.add(shaft);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(TOWER_R + 0.8, 3, 20), cap);
    crown.position.set(p.x, h + 1.5, p.z);
    group.add(crown);
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
