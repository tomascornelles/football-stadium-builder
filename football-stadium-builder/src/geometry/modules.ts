import * as THREE from 'three';
import { ModuleExterior, ModuleId, Stand } from '../types';
import { PITCH_LENGTH, PITCH_WIDTH, ROW_RISE, STAND_GAP } from '../config';

const HL = PITCH_LENGTH / 2; // 52.5 m
const HW = PITCH_WIDTH / 2; // 34 m
const QUARTER = Math.PI / 2;
const ARC_SEGMENTS = 32;
const ROOF_ARCH_STEPS = 12;
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

export interface StraightFrame {
  id: ModuleId;
  kind: 'straight';
  origin: THREE.Vector3;
  outward: THREE.Vector2; // (x, z)
  length: number;
}
export interface CornerFrame {
  id: ModuleId;
  kind: 'corner';
  origin: THREE.Vector3; // centro del arco = esquina del campo
  phiStart: number;
}
export type ModuleFrame = StraightFrame | CornerFrame;

const D = Math.SQRT1_2;

export const MODULE_FRAMES: Record<ModuleId, ModuleFrame> = {
  west: { id: 'west', kind: 'straight', origin: new THREE.Vector3(-HL, 0, 0), outward: new THREE.Vector2(-1, 0), length: PITCH_WIDTH },
  east: { id: 'east', kind: 'straight', origin: new THREE.Vector3(HL, 0, 0), outward: new THREE.Vector2(1, 0), length: PITCH_WIDTH },
  north: { id: 'north', kind: 'straight', origin: new THREE.Vector3(0, 0, -HW), outward: new THREE.Vector2(0, -1), length: PITCH_LENGTH },
  south: { id: 'south', kind: 'straight', origin: new THREE.Vector3(0, 0, HW), outward: new THREE.Vector2(0, 1), length: PITCH_LENGTH },
  nw: { id: 'nw', kind: 'corner', origin: new THREE.Vector3(-HL, 0, -HW), phiStart: Math.PI },
  ne: { id: 'ne', kind: 'corner', origin: new THREE.Vector3(HL, 0, -HW), phiStart: Math.PI / 2 },
  sw: { id: 'sw', kind: 'corner', origin: new THREE.Vector3(-HL, 0, HW), phiStart: -Math.PI / 2 },
  se: { id: 'se', kind: 'corner', origin: new THREE.Vector3(HL, 0, HW), phiStart: 0 },
};

/** Posición y rotación de un grupo en el mundo. */
export function modulePlacement(frame: ModuleFrame): { position: THREE.Vector3; rotationY: number } {
  if (frame.kind === 'corner') return { position: frame.origin.clone(), rotationY: 0 };
  return {
    position: frame.origin.clone(),
    rotationY: Math.atan2(-frame.outward.y, frame.outward.x),
  };
}

/**
 * Coordenadas locales del módulo: x = radial (hacia fuera), z = tangente.
 * t ∈ [0,1] recorre el módulo; r es la distancia radial.
 */
function placeAt(frame: ModuleFrame, t: number, r: number): { position: THREE.Vector3; rotationY: number } {
  if (frame.kind === 'straight') {
    return { position: new THREE.Vector3(r, 0, -frame.length / 2 + t * frame.length), rotationY: 0 };
  }
  const phi = frame.phiStart + t * QUARTER;
  return {
    position: new THREE.Vector3(Math.sin(phi) * r, 0, Math.cos(phi) * r),
    rotationY: phi - Math.PI / 2,
  };
}

function toWorld(frame: ModuleFrame, p: THREE.Vector3): THREE.Vector3 {
  const { position, rotationY } = modulePlacement(frame);
  return p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY).add(position);
}

/** Zona de selección de un módulo. */
export function hitboxFor(frame: ModuleFrame): {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotationY: number;
} {
  if (frame.kind === 'corner') {
    const geometry = new THREE.LatheGeometry(
      [new THREE.Vector2(STAND_GAP, 0.05), new THREE.Vector2(STAND_GAP + HITBOX_DEPTH, 0.05)],
      ARC_SEGMENTS,
      frame.phiStart,
      QUARTER,
    );
    return { geometry, position: frame.origin.clone(), rotationY: 0 };
  }
  const geometry = new THREE.PlaneGeometry(HITBOX_DEPTH, frame.length);
  geometry.rotateX(-Math.PI / 2);
  const { position, rotationY } = modulePlacement(frame);
  position.x += (frame.outward.x * HITBOX_DEPTH) / 2;
  position.z += (frame.outward.y * HITBOX_DEPTH) / 2;
  position.y = 0.05;
  return { geometry, position, rotationY };
}

/** Altura base de cada grada: se apilan por orden dentro de su módulo. */
export function layoutBaseHeights(stands: Stand[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const moduleId of Object.keys(MODULE_FRAMES) as ModuleId[]) {
    const sorted = stands
      .filter((s) => s.moduleId === moduleId)
      .sort((a, b) => a.order - b.order);
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

interface Profile {
  points: THREE.Vector2[];
  vFront: number;
  vBack: number;
}

/** Sección de la grada con pendiente real: distancia horizontal = altura / tan(inclinación). */
function buildProfile(stand: Stand, baseY: number): Profile {
  const h = stand.height;
  const run = h / Math.tan(THREE.MathUtils.degToRad(stand.tilt));
  const rows = rowCount(h);
  const rise = h / rows;
  const tread = run / rows;
  const vFront = STAND_GAP + stand.offset;
  const vBack = vFront + run;
  const bottom = baseY > 0 ? baseY - SLAB : 0;

  const points: THREE.Vector2[] = [
    new THREE.Vector2(vFront, bottom),
    new THREE.Vector2(vFront, baseY),
  ];
  for (let i = 0; i < rows; i++) {
    const y = baseY + (i + 1) * rise;
    points.push(new THREE.Vector2(vFront + i * tread, y));
    points.push(new THREE.Vector2(vFront + (i + 1) * tread, y));
  }
  points.push(new THREE.Vector2(vBack, bottom));
  return { points, vFront, vBack };
}

const v = (x: number, y: number) => new THREE.Vector2(x, y);
const rectPoints = (r1: number, y1: number, r2: number, y2: number) =>
  [v(r1, y1), v(r2, y1), v(r2, y2), v(r1, y2)];

function shapeFrom(points: THREE.Vector2[]): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) shape.lineTo(p.x, p.y);
  return shape;
}

/** Barre una sección a lo largo del módulo, con tapas en las esquinas. */
function sweepObject(frame: ModuleFrame, points: THREE.Vector2[], material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  if (frame.kind === 'straight') {
    const geo = new THREE.ExtrudeGeometry(shapeFrom(points), { depth: frame.length, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -frame.length / 2);
    group.add(new THREE.Mesh(geo, material));
    return group;
  }
  const closed = [...points, points[0]];
  group.add(new THREE.Mesh(new THREE.LatheGeometry(closed, ARC_SEGMENTS, frame.phiStart, QUARTER), material));
  const capGeo = new THREE.ShapeGeometry(shapeFrom(points));
  for (const phi of [frame.phiStart, frame.phiStart + QUARTER]) {
    const cap = new THREE.Mesh(capGeo, material);
    cap.rotation.y = phi - Math.PI / 2;
    group.add(cap);
  }
  return group;
}

function concreteMaterial() {
  return new THREE.MeshLambertMaterial({ color: CONCRETE, flatShading: true });
}

function addColumns(group: THREE.Group, frame: ModuleFrame, radii: number[], height: number, mat: THREE.Material) {
  if (height <= 0) return;
  const place = (x: number, z: number) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(COLUMN, height, COLUMN), mat);
    col.position.set(x, height / 2, z);
    group.add(col);
  };
  if (frame.kind === 'straight') {
    const n = Math.max(2, Math.round(frame.length / COLUMN_STEP) + 1);
    for (const r of radii) {
      for (let k = 0; k < n; k++) place(r, -frame.length / 2 + 1 + (k * (frame.length - 2)) / (n - 1));
    }
  } else {
    const n = 4;
    for (const r of radii) {
      for (let k = 0; k < n; k++) {
        const phi = frame.phiStart + (k * QUARTER) / (n - 1);
        place(Math.sin(phi) * r, Math.cos(phi) * r);
      }
    }
  }
}

/** Grupo 3D de una grada, ya colocado en su módulo. */
export function buildStandGroup(stand: Stand, baseY: number): THREE.Group {
  const frame = MODULE_FRAMES[stand.moduleId];
  const { points, vFront, vBack } = buildProfile(stand, baseY);
  const mat = new THREE.MeshLambertMaterial({ color: stand.color, flatShading: true, side: THREE.DoubleSide });

  const group = sweepObject(frame, points, mat);
  group.children.forEach((c) => (c.userData.isTier = true));

  if (baseY > 0 && stand.columns) {
    addColumns(group, frame, [vFront + 0.8, vBack - 0.8], baseY - SLAB, concreteMaterial());
  }
  if (stand.railing) {
    const rail = new THREE.MeshLambertMaterial({ color: STEEL, flatShading: true, side: THREE.DoubleSide });
    group.add(sweepObject(frame, rectPoints(vFront - RAIL_THICKNESS, baseY, vFront, baseY + RAIL_HEIGHT), rail));
  }

  const { position, rotationY } = modulePlacement(frame);
  group.position.copy(position);
  group.rotation.y = rotationY;
  group.userData.standId = stand.id;
  group.userData.moduleId = stand.moduleId;
  return group;
}

export interface ModuleExtent {
  front: number;
  back: number;
  top: number;
}

/** Extensión radial y altura máxima de las gradas de un módulo. */
export function moduleExtent(stands: Stand[], moduleId: ModuleId): ModuleExtent | null {
  const list = stands.filter((s) => s.moduleId === moduleId);
  if (list.length === 0) return null;
  const bases = layoutBaseHeights(list);
  let front = Infinity;
  let back = -Infinity;
  let top = 0;
  for (const s of list) {
    const vFront = STAND_GAP + s.offset;
    const run = s.height / Math.tan(THREE.MathUtils.degToRad(s.tilt));
    front = Math.min(front, vFront);
    back = Math.max(back, vFront + run);
    top = Math.max(top, (bases.get(s.id) ?? 0) + s.height);
  }
  return { front, back, top };
}

function resolveExtent(extent: ModuleExtent | null): ModuleExtent {
  return extent ?? { front: STAND_GAP, back: STAND_GAP + 10, top: 0 };
}

/* Texturas pixel art para fachadas (se generan una vez y se reutilizan). */
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

function wallRadius(ext: ModuleExterior, ex: ModuleExtent): number {
  return ex.back + ext.wallDistance;
}

/** Extremos de la fachada de un módulo en coordenadas del mundo. */
function wallEndsWorld(moduleId: ModuleId, ext: ModuleExterior, extent: ModuleExtent | null): THREE.Vector3[] {
  const frame = MODULE_FRAMES[moduleId];
  const r = wallRadius(ext, resolveExtent(extent));
  return [placeAt(frame, 0, r).position, placeAt(frame, 1, r).position].map((p) => toWorld(frame, p));
}

/**
 * Exteriores de un módulo: fachada, cubierta, focos y marcador.
 * Se construye en el sistema local del módulo.
 */
export function buildModuleStructures(
  moduleId: ModuleId,
  ext: ModuleExterior,
  extent: ModuleExtent | null,
): THREE.Group {
  const frame = MODULE_FRAMES[moduleId];
  const group = new THREE.Group();
  const ex = resolveExtent(extent);
  const wallR = wallRadius(ext, ex);

  // Fachada
  if (ext.wall !== 'none') {
    group.add(sweepObject(frame, rectPoints(wallR, 0, wallR + ext.wallThickness, ext.wallHeight), wallMaterial(ext)));
  }

  // Cubierta
  const deckY = ext.roof !== 'none' && extent ? ex.top + ext.roofHeight : ex.top + 4;
  if (ext.roof !== 'none' && extent) {
    const r1 = Math.max(1, ex.front - 1);
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
      points = [v(r1, y), v(r2, y + rise), v(r2, y + rise + T), v(r1, y + T)];
      backBase = y + rise;
    } else {
      const bottom: THREE.Vector2[] = [];
      const top: THREE.Vector2[] = [];
      for (let i = 0; i <= ROOF_ARCH_STEPS; i++) {
        const t = i / ROOF_ARCH_STEPS;
        const r = r1 + (r2 - r1) * t;
        const yb = y + rise * Math.sin(t * QUARTER);
        bottom.push(v(r, yb));
        top.push(v(r, yb + T));
      }
      points = [...bottom, ...top.reverse()];
      backBase = y + rise;
    }
    const roofMat = new THREE.MeshLambertMaterial({ color: ext.roofColor, flatShading: true, side: THREE.DoubleSide });
    group.add(sweepObject(frame, points, roofMat));
    if (ext.roofColumns) {
      addColumns(group, frame, [r2 - 0.8], backBase, concreteMaterial());
      if (ext.roof !== 'canopy') addColumns(group, frame, [r1 + 0.8], y, concreteMaterial());
    }
  }

  // Focos
  if (ext.flood === 'mast') {
    const towerR = (ext.wall !== 'none' ? wallR + ext.wallThickness : ex.back) + 2;
    const h = ext.floodHeight;
    const steel = new THREE.MeshLambertMaterial({ color: TOWER, flatShading: true });
    const lightMat = new THREE.MeshBasicMaterial({ color: ext.floodColor });
    for (let k = 0; k < ext.floodCount; k++) {
      const { position, rotationY } = placeAt(frame, (k + 0.5) / ext.floodCount, towerR);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), steel);
      tower.position.set(position.x, h / 2, position.z);
      group.add(tower);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 6), lightMat);
      head.position.set(position.x, h, position.z);
      head.rotation.y = rotationY;
      group.add(head);
    }
  } else if (ext.flood === 'bar') {
    const y0 = deckY - 1.4;
    const r = Math.max(1, ex.front - 1.5);
    group.add(sweepObject(frame, rectPoints(r - 0.4, y0, r + 0.4, y0 + 1.2), new THREE.MeshBasicMaterial({ color: ext.floodColor })));
  }

  // Marcador o pantalla
  if (ext.score !== 'none') {
    const r = Math.max(1, ex.front - 3);
    const h = ext.scoreHeight;
    const w = ext.scoreWidth;
    const { position: p, rotationY } = placeAt(frame, 0.5, r);
    const steel = new THREE.MeshLambertMaterial({ color: TOWER, flatShading: true });
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.6, h, 0.6), steel);
    pole.position.set(p.x, h / 2, p.z);
    group.add(pole);

    const boardY = h + (w * 0.5) / 2;
    const boardMat = new THREE.MeshBasicMaterial({ color: ext.score === 'marcador' ? 0x0f172a : 0x0ea5e9 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, w * 0.5, w), boardMat);
    board.position.set(p.x, boardY, p.z);
    board.rotation.y = rotationY;
    group.add(board);

    if (ext.score === 'marcador') {
      const frameMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, w * 0.5 + 0.8, w + 0.8),
        new THREE.MeshLambertMaterial({ color: STEEL, flatShading: true }),
      );
      const offset = new THREE.Vector3(0.6, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
      frameMesh.position.set(p.x + offset.x, boardY, p.z + offset.z);
      frameMesh.rotation.y = rotationY;
      group.add(frameMesh);
    }
  }

  const { position, rotationY } = modulePlacement(frame);
  group.position.copy(position);
  group.rotation.y = rotationY;
  return group;
}

/**
 * Muros de unión: donde dos fachadas vecinas no coinciden, se añade un muro que
 * enlaza el extremo más cercano de cada una.
 */
export function buildJunctions(
  exteriors: Record<ModuleId, ModuleExterior>,
  extents: Record<ModuleId, ModuleExtent | null>,
): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < RING.length; i++) {
    const a = RING[i];
    const b = RING[(i + 1) % RING.length];
    const ea = exteriors[a];
    const eb = exteriors[b];
    if (ea.wall === 'none' || eb.wall === 'none') continue;

    const pa = wallEndsWorld(a, ea, extents[a]);
    const pb = wallEndsWorld(b, eb, extents[b]);
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
