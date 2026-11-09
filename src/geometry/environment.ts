import * as THREE from 'three';
import { BUILDING_HEIGHT, BuildingKind, EnvCell } from '../types';
import { ENV_CELL, ENV_HALF, ENV_N, ENV_SIZE } from '../config';
import { cellKey } from '../environment';

const HALF = ENV_CELL / 2;
const WIDTH = { road: 12, avenue: 17, path: 6 } as const;
const SIDEWALK = 1.5;
const RING_IN = 14;
const RING_OUT = 26;

const COLORS = {
  grass: 0x4f9d4f,
  sidewalk: 0xcbd5e1,
  road: 0x374151,
  path: 0xd6c7a1,
  line: 0xf8fafc,
  steel: 0x9ca3af,
  roof: 0x7c2d12,
  crown: 0x4b5563,
  trunk: 0x6b4f2a,
  crownTree: 0x2f855a,
  water: 0x1f7a8c,
  sand: 0xd9c9a0,
  glassBand: 0xdbe9ec,
};
const CAR_COLORS = ['#e11d48', '#2563eb', '#f5f5f4', '#facc15', '#16a34a', '#7c3aed'];
const LIGHT_COLORS = [0xef4444, 0xfacc15, 0x22c55e];

/** Capas de superficie, de abajo arriba. */
const Y = { grass: -0.03, sand: -0.026, water: -0.0255, sidewalk: -0.024, road: -0.022, path: -0.0215, line: -0.021, island: -0.0205 };

const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Número pseudoaleatorio estable: el mismo entorno siempre se ve igual. */
const seeded = (n: number) => {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
};

const cellCenter = (i: number) => -ENV_HALF + (i + 0.5) * ENV_CELL;
const isVia = (t: string | undefined) => t === 'road' || t === 'avenue';
const isSurface = (t: string | undefined) => isVia(t) || t === 'path';

/** Acumula polígonos en una sola geometría por capa. */
class PolyBuffer {
  private pos: number[] = [];
  constructor(private y: number) {}

  /** Polígono convexo (abanico). */
  polygon(pts: [number, number][]) {
    for (let k = 1; k < pts.length - 1; k++) {
      for (const [x, z] of [pts[0], pts[k], pts[k + 1]]) this.pos.push(x, this.y, z);
    }
  }

  /** Polígono cualquiera (puede ser cóncavo). */
  polygonAny(pts: [number, number][]) {
    const tris = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
    for (const [a, b, c] of tris) {
      for (const k of [a, b, c]) this.pos.push(pts[k][0], this.y, pts[k][1]);
    }
  }

  /** Brazo que cambia de anchura entre dos distancias (une vías de distinto ancho). */
  taper(cx: number, cz: number, dx: number, dz: number, from: number, to: number, w0: number, w1: number) {
    const px = -dz;
    const pz = dx;
    const sx = cx + dx * from;
    const sz = cz + dz * from;
    const ex = cx + dx * to;
    const ez = cz + dz * to;
    this.polygon([
      [sx + px * (w0 / 2), sz + pz * (w0 / 2)],
      [ex + px * (w1 / 2), ez + pz * (w1 / 2)],
      [ex - px * (w1 / 2), ez - pz * (w1 / 2)],
      [sx - px * (w0 / 2), sz - pz * (w0 / 2)],
    ]);
  }

  /** Brazo rectangular desde (cx, cz) en la dirección (dx, dz). */
  arm(cx: number, cz: number, dx: number, dz: number, from: number, to: number, w: number) {
    const px = -dz * (w / 2);
    const pz = dx * (w / 2);
    const sx = cx + dx * from;
    const sz = cz + dz * from;
    const ex = cx + dx * to;
    const ez = cz + dz * to;
    this.polygon([[sx + px, sz + pz], [ex + px, ez + pz], [ex - px, ez - pz], [sx - px, sz - pz]]);
  }

  disc(cx: number, cz: number, r: number, seg = 18) {
    const pts: [number, number][] = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    this.polygon(pts);
  }

  /** Corona circular entre r0 y r1. */
  ring(cx: number, cz: number, r0: number, r1: number, seg = 36) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2;
      const a1 = ((k + 1) / seg) * Math.PI * 2;
      const at = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
      this.polygon([at(a0, r1), at(a1, r1), at(a1, r0), at(a0, r0)]);
    }
  }

  geometry(): THREE.BufferGeometry | null {
    if (this.pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.computeVertexNormals();
    return geo;
  }
}

/** Acumula cajas alineadas con los ejes en una sola geometría. */
class BoxBuffer {
  private pos: number[] = [];

  add(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const faces = [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    ];
    for (const f of faces) {
      for (const tri of [[0, 1, 2], [0, 2, 3]]) {
        for (const k of tri) this.pos.push(f[k][0], f[k][1], f[k][2]);
      }
    }
  }

  geometry(): THREE.BufferGeometry | null {
    if (this.pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.computeVertexNormals();
    return geo;
  }
}

function surfaceMesh(geo: THREE.BufferGeometry | null, color: number): THREE.Mesh | null {
  if (!geo) return null;
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
}

const at = (env: Record<string, EnvCell>, i: number, j: number) => env[cellKey(i, j)]?.type;

/* ---------- Agua con orillas suaves ---------- */

/** Píxeles de textura por celda. */
const TEX_CELL = 16;

const clampI = (v: number, N: number) => Math.min(N - 1, Math.max(0, v));

/** Desenfoque 3×3 separable de una rejilla N×N. */
function blurGrid(src: Float32Array, N: number): Float32Array {
  const k = [1, 2, 1];
  const tmp = new Float32Array(N * N);
  const out = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let d = -1; d <= 1; d++) s += k[d + 1] * src[j * N + clampI(i + d, N)];
      tmp[j * N + i] = s / 4;
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let d = -1; d <= 1; d++) s += k[d + 1] * tmp[clampI(j + d, N) * N + i];
      out[j * N + i] = s / 4;
    }
  }
  return out;
}

/** Interpolación bilineal; (fx, fy) en coordenadas de celda con centro en los enteros. */
function sampleGrid(g: Float32Array, N: number, fx: number, fy: number): number {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (x: number, y: number) => g[clampI(y, N) * N + clampI(x, N)];
  const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
  return a * (1 - ty) + b * ty;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const rgbOf = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

/**
 * Texturas del agua y de la arena. El contorno sale de las celdas de agua vecinas,
 * suavizado por desenfoque: las orillas siguen la forma del agua, no cada celda por separado.
 */
function waterTextures(env: Record<string, EnvCell>): { water: THREE.CanvasTexture; sand: THREE.CanvasTexture } {
  const N = ENV_N;
  const mask = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) mask[j * N + i] = at(env, i, j) === 'water' ? 1 : 0;
  }
  const near = blurGrid(mask, N);
  const wide = blurGrid(blurGrid(blurGrid(mask, N), N), N);

  const size = N * TEX_CELL;
  const cw = document.createElement('canvas');
  const cs = document.createElement('canvas');
  cw.width = cw.height = cs.width = cs.height = size;
  const gw = cw.getContext('2d')!;
  const gs = cs.getContext('2d')!;
  const iw = gw.createImageData(size, size);
  const is = gs.createImageData(size, size);
  const WATER = rgbOf(COLORS.water);
  const FOAM = rgbOf(0x7fd3df);
  const SAND = rgbOf(COLORS.sand);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x + 0.5) / TEX_CELL - 0.5;
      const fy = (y + 0.5) / TEX_CELL - 0.5;
      const w = sampleGrid(near, N, fx, fy);
      const sd = sampleGrid(wide, N, fx, fy);
      const p = (y * size + x) * 4;
      // Espuma en la franja de la orilla, agua en el centro
      const band = smoothstep(0.4, 0.5, w) * (1 - smoothstep(0.52, 0.75, w)) * 0.7;
      iw.data[p] = WATER[0] * (1 - band) + FOAM[0] * band;
      iw.data[p + 1] = WATER[1] * (1 - band) + FOAM[1] * band;
      iw.data[p + 2] = WATER[2] * (1 - band) + FOAM[2] * band;
      iw.data[p + 3] = smoothstep(0.4, 0.5, w) * 255;
      is.data[p] = SAND[0];
      is.data[p + 1] = SAND[1];
      is.data[p + 2] = SAND[2];
      is.data[p + 3] = smoothstep(0.1, 0.22, sd) * 255;
    }
  }
  gw.putImageData(iw, 0, 0);
  gs.putImageData(is, 0, 0);
  return { water: new THREE.CanvasTexture(cw), sand: new THREE.CanvasTexture(cs) };
}

/** Agua y arena: un plano por capa con la textura de su contorno. */
function buildWater(env: Record<string, EnvCell>): THREE.Group {
  const group = new THREE.Group();
  if (!Object.values(env).some((c) => c.type === 'water')) return group;
  const { water, sand } = waterTextures(env);
  const plane = (map: THREE.Texture, y: number) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ENV_SIZE, ENV_SIZE),
      new THREE.MeshLambertMaterial({ map, transparent: true, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    return mesh;
  };
  group.add(plane(sand, Y.sand));
  group.add(plane(water, Y.water));
  return group;
}

/* ---------- Carreteras, avenidas, caminos, glorietas y aparcamientos ---------- */

/**
 * Reglas de la red viaria:
 * - Glorieta: anillo de 8 vías alrededor de una celda libre.
 * - Aparcamiento: bloque de 3 × 3 vías con como máximo un acceso a la red.
 * - Cruce: vía con 3 o 4 vías vecinas (en T o en X). Nunca es aparcamiento.
 * - Vía: el resto de vías.
 */
export function classifyRoads(env: Record<string, EnvCell>) {
  const via = (i: number, j: number) => isVia(at(env, i, j));
  const parking = new Set<string>();
  const junction = new Set<string>();
  const inRound = new Set<string>();
  const roundCenters = new Set<string>();

  for (const [key, cell] of Object.entries(env)) {
    if (!isVia(cell.type)) continue;
    const [i, j] = key.split(',').map(Number);
    if (DIRS.filter(([dx, dz]) => via(i + dx, j + dz)).length >= 3) junction.add(key);

    let full3 = true;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (!via(i + di, j + dj)) full3 = false;
    if (!full3) continue;
    // Accesos: vías que tocan el bloque desde fuera, por cualquiera de sus cuatro lados
    let access = 0;
    for (let d = -1; d <= 1; d++) {
      if (via(i + d, j - 2)) access++;
      if (via(i + d, j + 2)) access++;
      if (via(i - 2, j + d)) access++;
      if (via(i + 2, j + d)) access++;
    }
    if (access <= 1) {
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) parking.add(cellKey(i + di, j + dj));
    }
  }

  for (const [key, cell] of Object.entries(env)) {
    if (!isVia(cell.type)) continue;
    const [i, j] = key.split(',').map(Number);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (di === 0 && dj === 0) continue;
      const ci = i + di;
      const cj = j + dj;
      if (via(ci, cj)) continue;
      let ring = true;
      for (let ei = -1; ei <= 1; ei++) for (let ej = -1; ej <= 1; ej++) {
        if ((ei !== 0 || ej !== 0) && !via(ci + ei, cj + ej)) ring = false;
      }
      if (!ring) continue;
      roundCenters.add(cellKey(ci, cj));
      for (let ei = -1; ei <= 1; ei++) for (let ej = -1; ej <= 1; ej++) {
        if (ei !== 0 || ej !== 0) inRound.add(cellKey(ci + ei, cj + ej));
      }
    }
  }
  return { parking, junction, inRound, roundCenters };
}

/** Paso de peatones (franjas paralelas al tráfico) y línea de detención en un brazo de cruce. */
function crosswalk(lines: PolyBuffer, cx: number, cz: number, dx: number, dz: number, W: number) {
  const px = -dz;
  const pz = dx;
  const s1 = HALF - 0.3;
  const s0 = HALF - 3.3;
  const count = Math.max(3, Math.floor((W - 1.5) / 1.6));
  for (let k = 0; k < count; k++) {
    const p = -(W - 2) / 2 + ((k + 0.5) * (W - 2)) / count;
    lines.arm(cx + px * p, cz + pz * p, dx, dz, s0, s1, 0.7);
  }
  const sStop = s0 - 0.6;
  const hw = (W - 1) / 2;
  const bx = cx + dx * sStop;
  const bz = cz + dz * sStop;
  lines.polygon([
    [bx - px * hw, bz - pz * hw],
    [bx + px * hw, bz + pz * hw],
    [bx + px * hw + dx * 0.45, bz + pz * hw + dz * 0.45],
    [bx - px * hw + dx * 0.45, bz - pz * hw + dz * 0.45],
  ]);
}

/** Semáforo y farolas se colocan en las vías; los coches circulan por los brazos. */
function buildRoads(env: Record<string, EnvCell>, night: boolean): THREE.Group {
  const group = new THREE.Group();
  const sidewalk = new PolyBuffer(Y.sidewalk);
  const road = new PolyBuffer(Y.road);
  const path = new PolyBuffer(Y.path);
  const lines = new PolyBuffer(Y.line);
  const island = new PolyBuffer(Y.island);
  const cars: THREE.Mesh[] = [];
  const lights: { x: number; z: number; color: number }[] = [];
  const lamps: [number, number][] = [];
  const via = (i: number, j: number) => isVia(at(env, i, j));
  const surf = (i: number, j: number) => isSurface(at(env, i, j));

  const { parking, junction, inRound, roundCenters } = classifyRoads(env);

  for (const [key, cell] of Object.entries(env)) {
    if (!isSurface(cell.type)) continue;
    const [i, j] = key.split(',').map(Number);
    const cx = cellCenter(i);
    const cz = cellCenter(j);
    if (inRound.has(key)) continue;

    if (cell.type === 'path') {
      path.disc(cx, cz, WIDTH.path / 2);
      for (const [dx, dz] of DIRS) if (surf(i + dx, j + dz)) path.arm(cx, cz, dx, dz, 0, HALF, WIDTH.path);
      continue;
    }

    if (parking.has(key)) {
      road.polygon([[cx - HALF, cz - HALF], [cx + HALF, cz - HALF], [cx + HALF, cz + HALF], [cx - HALF, cz + HALF]]);
      for (let k = -4; k <= 4; k++) lines.arm(cx + k * 2.5, cz - 8.5, 0, 1, 0, 17, 0.25);
      continue;
    }

    const W = WIDTH[cell.type as 'road' | 'avenue'];
    const surfArms = DIRS.filter(([dx, dz]) => surf(i + dx, j + dz));
    const viaArms = DIRS.filter(([dx, dz]) => via(i + dx, j + dz));

    // Anchura del brazo hacia cada vecino: si es otra vía, el brazo se ensancha con transición suave
    const widthTo = (dx: number, dz: number) => {
      const t = at(env, i + dx, j + dz);
      return isVia(t) ? WIDTH[t as 'road' | 'avenue'] : W;
    };
    const isJunction = junction.has(key);

    sidewalk.disc(cx, cz, W / 2 + SIDEWALK);
    for (const [dx, dz] of viaArms) sidewalk.taper(cx, cz, dx, dz, 0, HALF, W + 2 * SIDEWALK, widthTo(dx, dz) + 2 * SIDEWALK);

    road.disc(cx, cz, W / 2);
    for (const [dx, dz] of surfArms) {
      if (isVia(at(env, i + dx, j + dz))) road.taper(cx, cz, dx, dz, 0, HALF, W, widthTo(dx, dz));
      else road.arm(cx, cz, dx, dz, 0, HALF, W);
    }

    for (const [dx, dz] of viaArms) {
      if (isJunction) {
        // Cruce: sin líneas centrales, con paso de peatones y línea de detención en cada brazo
        crosswalk(lines, cx, cz, dx, dz, W);
        continue;
      }
      if (cell.type === 'avenue') {
        // Avenida: dos líneas discontinuas y mediana central con la vía vecina
        const px = -dz;
        const pz = dx;
        for (const s of [-3.5, 3.5]) lines.arm(cx + px * s, cz + pz * s, dx, dz, 6.5, 9.5, 0.3);
        if (at(env, i + dx, j + dz) === 'avenue') island.arm(cx, cz, dx, dz, 0, HALF, 3);
      } else {
        lines.arm(cx, cz, dx, dz, 6.5, 9.5, 0.3);
      }
    }

    if (viaArms.length > 0 && seeded(i * 91.3 + j * 47.9) < 0.45) {
      const [dx, dz] = viaArms[Math.floor(seeded(i * 13.7 + j * 29.1) * viaArms.length)];
      const lane = cell.type === 'avenue' ? 4 : 2.6;
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(4, 1.2, 2),
        new THREE.MeshLambertMaterial({ color: CAR_COLORS[Math.floor(seeded(i * 7.1 + j * 3.3) * CAR_COLORS.length)], flatShading: true }),
      );
      car.position.set(cx + dx * 8 - dz * lane, 0.6, cz + dz * 8 + dx * lane);
      car.rotation.y = Math.atan2(-dz, dx);
      cars.push(car);
    }

    if (surfArms.length >= 3) {
      lights.push({ x: cx + 7, z: cz - 7, color: LIGHT_COLORS[Math.floor(seeded(i * 5.3 + j * 2.9) * LIGHT_COLORS.length)] });
    }
    lamps.push([cx - 7.5, cz + 7.5]);
  }

  // Glorietas: anillo circular con isla, carril discontinuo, accesos y farolas
  for (const key of roundCenters) {
    const [ci, cj] = key.split(',').map(Number);
    const cx = cellCenter(ci);
    const cz = cellCenter(cj);
    sidewalk.ring(cx, cz, RING_IN - 1.5, RING_OUT + SIDEWALK);
    road.ring(cx, cz, RING_IN, RING_OUT);
    island.disc(cx, cz, RING_IN);

    const seg = 48;
    const laneR = (RING_IN + RING_OUT) / 2;
    for (let k = 0; k < seg; k += 2) {
      const a0 = (k / seg) * Math.PI * 2;
      const a1 = ((k + 1) / seg) * Math.PI * 2;
      const pt = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
      lines.polygon([pt(a0, laneR - 0.2), pt(a1, laneR - 0.2), pt(a1, laneR + 0.2), pt(a0, laneR + 0.2)]);
    }

    for (const [dx, dz] of DIRS) {
      if (!via(ci + 2 * dx, cj + 2 * dz)) continue;
      sidewalk.arm(cx, cz, dx, dz, RING_OUT - 6, 31, WIDTH.road + 2 * SIDEWALK);
      road.arm(cx, cz, dx, dz, RING_OUT - 6, 31, WIDTH.road);
    }

    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      lamps.push([cx + Math.cos(a) * 30, cz + Math.sin(a) * 30]);
    }
  }

  const add = (mesh: THREE.Mesh | null) => { if (mesh) group.add(mesh); };
  add(surfaceMesh(sidewalk.geometry(), COLORS.sidewalk));
  add(surfaceMesh(road.geometry(), COLORS.road));
  add(surfaceMesh(path.geometry(), COLORS.path));
  add(surfaceMesh(lines.geometry(), COLORS.line));
  add(surfaceMesh(island.geometry(), COLORS.grass));
  cars.forEach((c) => group.add(c));

  const steel = new THREE.MeshLambertMaterial({ color: COLORS.steel, flatShading: true });
  for (const l of lights) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.5, 0.35), steel);
    pole.position.set(l.x, 2.25, l.z);
    group.add(pole);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), new THREE.MeshBasicMaterial({ color: 0x111827 }));
    housing.position.set(l.x, 4.6, l.z);
    group.add(housing);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), new THREE.MeshBasicMaterial({ color: l.color }));
    lamp.position.set(l.x, 4.6, l.z + 0.55);
    group.add(lamp);
  }

  if (night) {
    const poleMat = new THREE.MeshLambertMaterial({ color: COLORS.steel, flatShading: true });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff1c1 });
    const glowMat = glowMaterial();
    const glowGeo = new THREE.PlaneGeometry(12, 12);
    glowGeo.rotateX(-Math.PI / 2);
    for (const [x, z] of lamps) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), poleMat);
      pole.position.set(x, 3, z);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), headMat);
      head.position.set(x, 6.2, z);
      group.add(head);
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(x, 0.07, z);
      group.add(glow);
    }
  }
  return group;
}

/* ---------- Edificios ---------- */

/** Edificio: casa con tejado, bloque de oficinas o torre acristalada con forjados. */
function buildBuilding(group: THREE.Group, cx: number, cz: number, kind: BuildingKind, h: number, color: string, bands: BoxBuffer) {
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  if (kind === 'house') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, h, 14), mat);
    body.position.set(cx, h / 2, cz);
    group.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(11, 5, 4),
      new THREE.MeshLambertMaterial({ color: COLORS.roof, flatShading: true }),
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(cx, h + 2.5, cz);
    group.add(roof);
  } else if (kind === 'tower') {
    // Torre de oficinas: fuste alto con forjados claros cada 4 m y remate
    const body = new THREE.Mesh(new THREE.BoxGeometry(12, h, 12), mat);
    body.position.set(cx, h / 2, cz);
    group.add(body);
    for (let y = 4; y < h - 1; y += 4) bands.add(cx, y, cz, 12.6, 0.5, 12.6);
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2, 10),
      new THREE.MeshLambertMaterial({ color: COLORS.crown, flatShading: true }),
    );
    crown.position.set(cx, h + 1, cz);
    group.add(crown);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, h, 16), mat);
    body.position.set(cx, h / 2, cz);
    group.add(body);
  }
}

let glowTex: THREE.CanvasTexture | null = null;

/** Halo luminoso aditivo, para las farolas y los focos del entorno. */
function glowMaterial(): THREE.MeshBasicMaterial {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
    grad.addColorStop(1, 'rgba(255, 214, 140, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  return new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Ventanas iluminadas de los edificios, en una sola geometría. */
function windowsMesh(env: Record<string, EnvCell>): THREE.Mesh | null {
  const pos: number[] = [];
  const faces: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [key, cell] of Object.entries(env)) {
    if (cell.type !== 'building') continue;
    const [i, j] = key.split(',').map(Number);
    const kind = cell.kind ?? 'building';
    const h = cell.height ?? BUILDING_HEIGHT[kind];
    const s = kind === 'house' ? 7 : kind === 'tower' ? 6 : 8;
    const cx = cellCenter(i);
    const cz = cellCenter(j);
    const cols = Math.max(2, Math.floor((2 * s - 2) / 3));
    const rows = Math.max(1, Math.floor((h - 3) / 3.5));
    faces.forEach(([nx, nz], f) => {
      const tx = -nz;
      const tz = nx;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (seeded(i * 31.7 + j * 17.3 + f * 11.1 + r * 3.3 + c * 1.7) > 0.45) continue;
          const u = -s + 1.5 + ((c + 0.5) * (2 * s - 3)) / cols;
          const y = 2.5 + ((r + 0.5) * (h - 4)) / rows;
          const ox = cx + nx * (s + 0.05) + tx * u;
          const oz = cz + nz * (s + 0.05) + tz * u;
          const hw = 0.6;
          const hh = 0.7;
          const a = [ox - tx * hw, y - hh, oz - tz * hw];
          const b = [ox + tx * hw, y - hh, oz + tz * hw];
          const cc = [ox + tx * hw, y + hh, oz + tz * hw];
          const d = [ox - tx * hw, y + hh, oz - tz * hw];
          pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
        }
      }
    });
  }
  if (pos.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd98a, side: THREE.DoubleSide }));
}

/** Entorno: césped de parque por defecto, agua, vías, árboles, edificios. De noche, con luces. */
export function buildEnvironment(env: Record<string, EnvCell>, night = false): THREE.Group {
  const group = new THREE.Group();

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(ENV_SIZE, ENV_SIZE),
    new THREE.MeshLambertMaterial({ color: COLORS.grass }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = Y.grass;
  group.add(grass);
  group.add(buildWater(env));

  const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.trunk, flatShading: true });
  const crownMat = new THREE.MeshLambertMaterial({ color: COLORS.crownTree, flatShading: true });
  const bands = new BoxBuffer();

  for (const [key, cell] of Object.entries(env)) {
    if (cell.type === 'road' || cell.type === 'avenue' || cell.type === 'path' || cell.type === 'water') continue;
    const [i, j] = key.split(',').map(Number);
    const cx = cellCenter(i);
    const cz = cellCenter(j);

    if (cell.type === 'building') {
      const kind = cell.kind ?? 'building';
      buildBuilding(group, cx, cz, kind, cell.height ?? BUILDING_HEIGHT[kind], cell.color ?? '#d6d3cd', bands);
      continue;
    }

    // Parque con árboles repartidos al azar
    if (cell.tree) {
      const n = 3 + Math.floor(seeded(i * 73.1 + j * 37.7) * 4);
      for (let k = 0; k < n; k++) {
        const x = cx + (seeded(i * 17.3 + j * 5.1 + k * 3.7) - 0.5) * (ENV_CELL - 6);
        const z = cz + (seeded(i * 9.7 + j * 11.9 + k * 6.1) - 0.5) * (ENV_CELL - 6);
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 0.8), trunkMat);
        trunk.position.set(x, 1.5, z);
        group.add(trunk);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), crownMat);
        crown.position.set(x, 4.6, z);
        group.add(crown);
      }
    }
  }

  const bandMesh = surfaceMesh(bands.geometry(), COLORS.glassBand);
  if (bandMesh) group.add(bandMesh);

  group.add(buildRoads(env, night));
  if (night) {
    const w = windowsMesh(env);
    if (w) group.add(w);
  }
  return group;
}

/** Líneas de la cuadrícula, visibles solo en modo entorno. */
export function buildGridLines(): THREE.LineSegments {
  const pts: THREE.Vector3[] = [];
  const y = -0.025;
  for (let k = 0; k <= ENV_N; k++) {
    const p = -ENV_HALF + k * ENV_CELL;
    pts.push(new THREE.Vector3(p, y, -ENV_HALF), new THREE.Vector3(p, y, ENV_HALF));
    pts.push(new THREE.Vector3(-ENV_HALF, y, p), new THREE.Vector3(ENV_HALF, y, p));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.35 }),
  );
}
