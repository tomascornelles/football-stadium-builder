import * as THREE from 'three';
import { BUILDING_HEIGHT, BuildingKind, EnvCell } from '../types';
import { ENV_CELL, ENV_HALF, ENV_N, ENV_SIZE } from '../config';
import { cellKey } from '../environment';

const ROAD_W = 12;
const PATH_W = 6;
const SIDEWALK = 1.5;
const HALF = ENV_CELL / 2;
const ROUND_ISLAND = 9;
const ROUND_OUTER = 21;

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
};
const CAR_COLORS = ['#e11d48', '#2563eb', '#f5f5f4', '#facc15', '#16a34a', '#7c3aed'];
const LIGHT_COLORS = [0xef4444, 0xfacc15, 0x22c55e];

/** Capas de superficie, de abajo arriba. */
const Y = { grass: -0.03, sidewalk: -0.024, road: -0.022, path: -0.0215, line: -0.021, island: -0.0205 };

const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Número pseudoaleatorio estable: el mismo entorno siempre se ve igual. */
const seeded = (n: number) => {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
};

const cellCenter = (i: number) => -ENV_HALF + (i + 0.5) * ENV_CELL;

/** Acumula polígonos convexos en una sola geometría por capa. */
class PolyBuffer {
  private pos: number[] = [];
  constructor(private y: number) {}

  polygon(pts: [number, number][]) {
    for (let k = 1; k < pts.length - 1; k++) {
      for (const [x, z] of [pts[0], pts[k], pts[k + 1]]) this.pos.push(x, this.y, z);
    }
  }

  /** Brazo rectangular desde el centro (cx, cz) en la dirección (dx, dz). */
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

  /** Corona circular entre r0 y r1 (glorieta). */
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

function surfaceMesh(geo: THREE.BufferGeometry | null, color: number): THREE.Mesh | null {
  if (!geo) return null;
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
}

function isRoad(env: Record<string, EnvCell>, i: number, j: number) {
  return env[cellKey(i, j)]?.type === 'road';
}

function isSurface(env: Record<string, EnvCell>, i: number, j: number) {
  const t = env[cellKey(i, j)]?.type;
  return t === 'road' || t === 'path';
}

/** Carreteras y caminos unidos. Cruces con semáforo; bloques de 3 × 3 son glorietas. */
function buildRoads(env: Record<string, EnvCell>): THREE.Group {
  const group = new THREE.Group();
  const sidewalk = new PolyBuffer(Y.sidewalk);
  const road = new PolyBuffer(Y.road);
  const path = new PolyBuffer(Y.path);
  const lines = new PolyBuffer(Y.line);
  const island = new PolyBuffer(Y.island);
  const cars: THREE.Mesh[] = [];
  const lights: { x: number; z: number; color: number }[] = [];

  // Glorietas: un bloque de 3 × 3 carreteras, con su centro como isla
  const roundCenters = new Set<string>();
  const inRound = new Set<string>();
  for (const [key, cell] of Object.entries(env)) {
    if (cell.type !== 'road') continue;
    const [i, j] = key.split(',').map(Number);
    let all = true;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!isRoad(env, i + di, j + dj)) all = false;
    }
    if (!all) continue;
    roundCenters.add(key);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) inRound.add(cellKey(i + di, j + dj));
  }

  for (const [key, cell] of Object.entries(env)) {
    if (cell.type !== 'road' && cell.type !== 'path') continue;
    const [i, j] = key.split(',').map(Number);
    const cx = cellCenter(i);
    const cz = cellCenter(j);

    const arms = DIRS.filter(([dx, dz]) => isSurface(env, i + dx, j + dz));

    if (cell.type === 'path') {
      path.disc(cx, cz, PATH_W / 2);
      for (const [dx, dz] of arms) path.arm(cx, cz, dx, dz, 0, HALF, PATH_W);
      continue;
    }

    if (roundCenters.has(key)) {
      sidewalk.ring(cx, cz, ROUND_ISLAND - 1, ROUND_OUTER + SIDEWALK + 1.5);
      road.ring(cx, cz, ROUND_ISLAND, ROUND_OUTER);
      island.disc(cx, cz, ROUND_ISLAND);
      continue;
    }

    const roadArms = DIRS.filter(([dx, dz]) => isRoad(env, i + dx, j + dz));
    const block = inRound.has(key);

    sidewalk.disc(cx, cz, ROAD_W / 2 + SIDEWALK);
    for (const [dx, dz] of roadArms) sidewalk.arm(cx, cz, dx, dz, 0, HALF, ROAD_W + 2 * SIDEWALK);

    road.disc(cx, cz, ROAD_W / 2);
    for (const [dx, dz] of arms) road.arm(cx, cz, dx, dz, 0, HALF, ROAD_W);

    // Línea central discontinua (no dentro de glorietas)
    if (!block) {
      for (const [dx, dz] of roadArms) lines.arm(cx, cz, dx, dz, ROAD_W / 2 + 0.5, ROAD_W / 2 + 3.5, 0.3);
    }

    // Coche por el carril derecho de uno de los brazos
    if (roadArms.length > 0 && !block && seeded(i * 91.3 + j * 47.9) < 0.45) {
      const [dx, dz] = roadArms[Math.floor(seeded(i * 13.7 + j * 29.1) * roadArms.length)];
      const x = cx + dx * 8 - dz * 2.6;
      const z = cz + dz * 8 + dx * 2.6;
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(4, 1.2, 2),
        new THREE.MeshLambertMaterial({ color: CAR_COLORS[Math.floor(seeded(i * 7.1 + j * 3.3) * CAR_COLORS.length)], flatShading: true }),
      );
      car.position.set(x, 0.6, z);
      car.rotation.y = Math.atan2(-dz, dx);
      cars.push(car);
    }

    // Semáforo en los cruces de tres o cuatro brazos
    if (!block && arms.length >= 3) {
      lights.push({
        x: cx + 7,
        z: cz - 7,
        color: LIGHT_COLORS[Math.floor(seeded(i * 5.3 + j * 2.9) * LIGHT_COLORS.length)],
      });
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
  return group;
}

/** Edificio: casa con tejado a cuatro aguas, edificio de bloque o torre con remate. */
function buildBuilding(group: THREE.Group, cx: number, cz: number, kind: BuildingKind, h: number, color: string) {
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
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, h, 8), mat);
    body.position.set(cx, h / 2, cz);
    group.add(body);
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(10, 3, 10),
      new THREE.MeshLambertMaterial({ color: COLORS.crown, flatShading: true }),
    );
    crown.position.set(cx, h + 1.5, cz);
    group.add(crown);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, h, 16), mat);
    body.position.set(cx, h / 2, cz);
    group.add(body);
  }
}

/** Entorno: césped de parque por defecto, carreteras, caminos, árboles y edificios. */
export function buildEnvironment(env: Record<string, EnvCell>): THREE.Group {
  const group = new THREE.Group();

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(ENV_SIZE, ENV_SIZE),
    new THREE.MeshLambertMaterial({ color: COLORS.grass }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = Y.grass;
  group.add(grass);

  const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.trunk, flatShading: true });
  const crownMat = new THREE.MeshLambertMaterial({ color: COLORS.crownTree, flatShading: true });

  for (const [key, cell] of Object.entries(env)) {
    if (cell.type === 'road' || cell.type === 'path') continue;
    const [i, j] = key.split(',').map(Number);
    const cx = cellCenter(i);
    const cz = cellCenter(j);

    if (cell.type === 'building') {
      const kind = cell.kind ?? 'building';
      buildBuilding(group, cx, cz, kind, cell.height ?? BUILDING_HEIGHT[kind], cell.color ?? '#d6d3cd');
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

  group.add(buildRoads(env));
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
