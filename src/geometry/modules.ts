import * as THREE from 'three';
import { MODULE_IDS, ModuleExterior, ModuleId, Stand } from '../types';
import { PITCH_LENGTH, PITCH_WIDTH, ROW_RISE, STAND_GAP } from '../config';

const HALF_L = PITCH_LENGTH / 2; // 52.5 m
const HALF_W = PITCH_WIDTH / 2; // 34 m
const ARC_SEGMENTS = 32;
/** Flecha de una grada curva (m, hacia fuera). */
const CURVE_BULGE = 14;
/** Flecha de una esquina en cuarto de circunferencia respecto a su cuerda. */
const CORNER_FACTOR = 0.2071;
/** Grada elevada. */
const SLAB = 1.0;
const COLUMN = 0.9;
const COLUMN_STEP = 8;
const CONCRETE = 0xb9c0c9;
const STEEL = 0xd1d5db;
const TOWER = 0x9ca3af;
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
    return {
      segments: 1,
      length: len,
      at: (t) => ({ p: a.clone().lerp(b, t), n: outward.clone() }),
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

  return {
    segments: ARC_SEGMENTS,
    length: Math.abs(delta) * R,
    at: (t) => {
      const th = th0 + delta * t;
      const c = Math.cos(th);
      const s = Math.sin(th);
      return { p: v2(center.x + R * c, center.y + R * s), n: v2(c, s) };
    },
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

/* ---------- Anclas: lo que cada módulo ofrece a sus vecinos ---------- */

export interface Anchor {
  /** Distancia de la línea de banda o de fondo a la primera fila. */
  v: number;
  curved: boolean;
}
export type Anchors = Record<ModuleId, Anchor>;

/**
 * Ancla de cada módulo recto: la grada de la primera fila (la más baja).
 * Las esquinas se ajustan a los extremos de estas anclas.
 */
export function computeAnchors(stands: Stand[]): Anchors {
  const out = {} as Anchors;
  for (const id of MODULE_IDS) out[id] = { v: STAND_GAP, curved: false };
  for (const id of RING) {
    if (isCorner(id)) continue;
    const first = stands
      .filter((s) => s.moduleId === id)
      .sort((a, b) => a.order - b.order)[0];
    if (first) out[id] = { v: STAND_GAP + first.offset, curved: first.curved };
  }
  return out;
}

/** Extremos del módulo. En las esquinas, son los extremos de los vecinos. */
function endpoints(id: ModuleId, anchors: Anchors): [THREE.Vector2, THREE.Vector2] {
  if (!isCorner(id)) return straightEnds(id, anchors[id].v);
  const i = RING.indexOf(id);
  const prev = RING[(i + RING.length - 1) % RING.length];
  const next = RING[(i + 1) % RING.length];
  return [straightEnds(prev, anchors[prev].v)[1], straightEnds(next, anchors[next].v)[0]];
}

/** Curva de referencia de un módulo (la de su ancla). */
export function moduleFrame(id: ModuleId, anchors: Anchors): Frame {
  const [a, b] = endpoints(id, anchors);
  const sag = isCorner(id)
    ? CORNER_FACTOR * a.distanceTo(b)
    : anchors[id].curved ? CURVE_BULGE : 0;
  return buildFrame(a, b, sag);
}

/** Curva de una grada concreta. Las esquinas siguen la del módulo. */
export function standFrame(stand: Stand, anchors: Anchors): Frame {
  if (isCorner(stand.moduleId)) return moduleFrame(stand.moduleId, anchors);
  const [a, b] = straightEnds(stand.moduleId, STAND_GAP + stand.offset);
  return buildFrame(a, b, stand.curved ? CURVE_BULGE : 0);
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

/** Sección de la grada en (u, y). Pendiente real: u = altura / tan(inclinación). */
function profileUY(stand: Stand, baseY: number): { points: THREE.Vector2[]; run: number } {
  const h = stand.height;
  const run = h / Math.tan(THREE.MathUtils.degToRad(stand.tilt));
  const rows = rowCount(h);
  const rise = h / rows;
  const tread = run / rows;
  const bottom = baseY > 0 ? baseY - SLAB : 0;

  const points: THREE.Vector2[] = [v2(0, bottom), v2(0, baseY)];
  for (let i = 0; i < rows; i++) {
    const y = baseY + (i + 1) * rise;
    points.push(v2(i * tread, y));
    points.push(v2((i + 1) * tread, y));
  }
  points.push(v2(run, bottom));
  return { points, run };
}

/** Grupo 3D de una grada en coordenadas del mundo. */
export function buildStandGroup(stand: Stand, baseY: number, anchors: Anchors): THREE.Group {
  const frame = standFrame(stand, anchors);
  const { points, run } = profileUY(stand, baseY);
  const mat = new THREE.MeshLambertMaterial({ color: stand.color, flatShading: true, side: THREE.DoubleSide });
  const group = new THREE.Group();

  const tier = sweepMesh(frame, points, mat);
  tier.userData.isTier = true;
  group.add(tier);

  if (baseY > 0 && stand.columns) {
    addColumnsAlong(group, frame, [0.8, run - 0.8], baseY - SLAB, concreteMaterial());
  }
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
  top: number;
}

/** Extensión de las gradas de un módulo respecto a su curva de referencia. */
export function moduleExtent(stands: Stand[], moduleId: ModuleId): ModuleExtent | null {
  const list = stands.filter((s) => s.moduleId === moduleId);
  if (list.length === 0) return null;
  const anchors = computeAnchors(stands);
  const bases = layoutBaseHeights(list);
  let back = -Infinity;
  let top = 0;
  for (const s of list) {
    const rel = isCorner(moduleId) ? 0 : STAND_GAP + s.offset - anchors[moduleId].v;
    const run = s.height / Math.tan(THREE.MathUtils.degToRad(s.tilt));
    back = Math.max(back, rel + run);
    top = Math.max(top, (bases.get(s.id) ?? 0) + s.height);
  }
  return { front: 0, back, top };
}

function resolveExtent(extent: ModuleExtent | null): ModuleExtent {
  return extent ?? { front: 0, back: 10, top: 0 };
}

/* ---------- Exteriores ---------- */

const textureCache = new Map<string, THREE.CanvasTexture>();

function patternTexture(kind: 'brick' | 'windows' | 'panels'): THREE.CanvasTexture {
  const cached = textureCache.get(kind);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 32, 32);
  if (kind === 'brick') {
    g.fillStyle = '#8c8c8c';
    for (let r = 0; r < 4; r++) {
      const y = r * 8;
      const off = (r % 2) * 16;
      g.fillRect(0, y, 32, 1);
      g.fillRect(off, y, 1, 8);
      g.fillRect((off + 16) % 32, y, 1, 8);
    }
  } else if (kind === 'windows') {
    g.fillStyle = '#3f4650';
    g.fillRect(2, 4, 28, 12);
    g.fillRect(2, 20, 28, 8);
  } else {
    g.fillStyle = '#e2e2e2';
    g.fillRect(0, 0, 16, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.5, 0.5);
  textureCache.set(kind, tex);
  return tex;
}

function wallMaterial(ext: ModuleExterior): THREE.MeshLambertMaterial {
  const base: THREE.MeshLambertMaterialParameters = {
    color: ext.wallColor,
    flatShading: true,
    side: THREE.DoubleSide,
  };
  if (ext.wall === 'glass') {
    return new THREE.MeshLambertMaterial({ ...base, transparent: true, opacity: 0.45, depthWrite: false });
  }
  if (ext.wall === 'brick' || ext.wall === 'windows' || ext.wall === 'panels') {
    return new THREE.MeshLambertMaterial({ ...base, map: patternTexture(ext.wall) });
  }
  return new THREE.MeshLambertMaterial(base);
}

/** Exteriores de un módulo: fachada, cubierta, focos y marcador. */
export function buildModuleStructures(
  moduleId: ModuleId,
  ext: ModuleExterior,
  extent: ModuleExtent | null,
  anchors: Anchors,
): THREE.Group {
  const frame = moduleFrame(moduleId, anchors);
  const group = new THREE.Group();
  const ex = resolveExtent(extent);
  const wallU = ex.back + ext.wallDistance;

  if (ext.wall !== 'none') {
    group.add(sweepMesh(frame, rectPoints(wallU, 0, wallU + ext.wallThickness, ext.wallHeight), wallMaterial(ext)));
  }

  const deckY = ext.roof !== 'none' && extent ? ex.top + ext.roofHeight : ex.top + 4;
  if (ext.roof !== 'none' && extent) {
    const r1 = -1;
    const r2 = ex.back + ext.roofOverhang;
    const y = deckY;
    const T = ext.roofThickness;
    const rise = (r2 - r1) * Math.tan(THREE.MathUtils.degToRad(ext.roofSlope));
    let points: THREE.Vector2[];
    let backBase: number;
    if (ext.roof === 'canopy') {
      points = rectPoints(r1, y, r2, y + T);
      backBase = y;
    } else if (ext.roof === 'cantilever') {
      points = [v2(r1, y), v2(r2, y + rise), v2(r2, y + rise + T), v2(r1, y + T)];
      backBase = y + rise;
    } else {
      const bottom: THREE.Vector2[] = [];
      const top: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const r = r1 + (r2 - r1) * t;
        const yb = y + rise * Math.sin(t * Math.PI / 2);
        bottom.push(v2(r, yb));
        top.push(v2(r, yb + T));
      }
      points = [...bottom, ...top.reverse()];
      backBase = y + rise;
    }
    const roofMat = new THREE.MeshLambertMaterial({ color: ext.roofColor, flatShading: true, side: THREE.DoubleSide });
    group.add(sweepMesh(frame, points, roofMat));
    if (ext.roofColumns) {
      addColumnsAlong(group, frame, [r2 - 0.8], backBase, concreteMaterial());
      if (ext.roof !== 'canopy') addColumnsAlong(group, frame, [r1 + 0.8], y, concreteMaterial());
    }
  }

  if (ext.flood === 'mast') {
    const towerU = (ext.wall !== 'none' ? wallU + ext.wallThickness : ex.back) + 2;
    const h = ext.floodHeight;
    const steel = new THREE.MeshLambertMaterial({ color: TOWER, flatShading: true });
    const lightMat = new THREE.MeshBasicMaterial({ color: ext.floodColor });
    const towers = isCorner(moduleId) ? 1 : ext.floodCount;
    for (let k = 0; k < towers; k++) {
      const t = (k + 0.5) / towers;
      const p = surface(frame, t, towerU);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), steel);
      tower.position.set(p.x, h / 2, p.z);
      group.add(tower);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 6), lightMat);
      head.position.set(p.x, h, p.z);
      head.rotation.y = faceRotation(frame.at(t).n);
      group.add(head);
    }
  } else if (ext.flood === 'bar') {
    const y0 = deckY - 1.4;
    const u = -1.2;
    group.add(sweepMesh(frame, rectPoints(u - 0.4, y0, u + 0.4, y0 + 1.2), new THREE.MeshBasicMaterial({ color: ext.floodColor })));
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
  return group;
}

/** Extremos de la fachada de un módulo en el mundo. */
function wallEnds(moduleId: ModuleId, ext: ModuleExterior, extent: ModuleExtent | null, anchors: Anchors): THREE.Vector3[] {
  const u = resolveExtent(extent).back + ext.wallDistance;
  const frame = moduleFrame(moduleId, anchors);
  return [surface(frame, 0, u), surface(frame, 1, u)];
}

/** Muros de unión entre fachadas vecinas que no coinciden. */
export function buildJunctions(
  exteriors: Record<ModuleId, ModuleExterior>,
  extents: Record<ModuleId, ModuleExtent | null>,
  anchors: Anchors,
): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < RING.length; i++) {
    const a = RING[i];
    const b = RING[(i + 1) % RING.length];
    const ea = exteriors[a];
    const eb = exteriors[b];
    if (ea.wall === 'none' || eb.wall === 'none') continue;

    const pa = wallEnds(a, ea, extents[a], anchors);
    const pb = wallEnds(b, eb, extents[b], anchors);
    let best: { p: THREE.Vector3; q: THREE.Vector3; d: number } | null = null;
    for (const p of pa) {
      for (const q of pb) {
        const d = p.distanceTo(q);
        if (!best || d < best.d) best = { p, q, d };
      }
    }
    if (!best || best.d < 0.5) continue;

    const { p, q, d } = best;
    const h = Math.max(ea.wallHeight, eb.wallHeight);
    const t = Math.max(ea.wallThickness, eb.wallThickness);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(d, h, t), wallMaterial(ea));
    mesh.position.set((p.x + q.x) / 2, h / 2, (p.z + q.z) / 2);
    mesh.rotation.y = Math.atan2(-(q.z - p.z), q.x - p.x);
    group.add(mesh);
  }
  return group;
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
