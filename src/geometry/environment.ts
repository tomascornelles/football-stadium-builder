import * as THREE from 'three';
import { EnvCell } from '../types';
import { ENV_CELL, ENV_HALF, ENV_N } from '../config';
import { cellKey } from '../environment';

const ROAD_W = 12;
const PATH_W = 6;
const SIDEWALK = 1.5;
const HALF = ENV_CELL / 2;

const COLORS = {
  park: 0x4f9d4f,
  sidewalk: 0xcbd5e1,
  road: 0x374151,
  path: 0xd6c7a1,
  line: 0xf8fafc,
};
const CAR_COLORS = ['#e11d48', '#2563eb', '#f5f5f4', '#facc15', '#16a34a', '#7c3aed'];

/** Layers de superficie, de abajo arriba (evitan parpadeo entre capas). */
const Y = { sidewalk: -0.024, road: -0.022, path: -0.0215, line: -0.021 };

const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Número pseudoaleatorio estable: el mismo entorno siempre tiene los mismos coches. */
const seeded = (n: number) => {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
};

const cellCenter = (i: number) => -ENV_HALF + (i + 0.5) * ENV_CELL;

/** Acumula polígonos convexos (rectángulos y discos) en una sola geometría por capa. */
class PolyBuffer {
  private pos: number[] = [];
  constructor(private y: number) {}

  polygon(pts: [number, number][]) {
    for (let k = 1; k < pts.length - 1; k++) {
      for (const [x, z] of [pts[0], pts[k], pts[k + 1]]) this.pos.push(x, this.y, z);
    }
  }

  /** Tira que parte del centro (cx, cz) en la dirección (dx, dz). */
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

/**
 * Carreteras y caminos. Cada celda dibuja un disco central y un brazo hacia cada vecino
 * con carretera o camino, así las curvas y los cruces se unen sin huecos.
 */
function buildRoads(env: Record<string, EnvCell>): THREE.Group {
  const group = new THREE.Group();
  const sidewalk = new PolyBuffer(Y.sidewalk);
  const road = new PolyBuffer(Y.road);
  const path = new PolyBuffer(Y.path);
  const lines = new PolyBuffer(Y.line);
  const cars: THREE.Mesh[] = [];

  const neighbor = (i: number, j: number, dx: number, dz: number) => env[cellKey(i + dx, j + dz)];

  for (const [key, cell] of Object.entries(env)) {
    if (cell.type !== 'road' && cell.type !== 'path') continue;
    const [i, j] = key.split(',').map(Number);
    const cx = cellCenter(i);
    const cz = cellCenter(j);

    const arms = DIRS.filter(([dx, dz]) => {
      const n = neighbor(i, j, dx, dz);
      return n && (n.type === 'road' || n.type === 'path');
    });

    if (cell.type === 'path') {
      path.disc(cx, cz, PATH_W / 2);
      for (const [dx, dz] of arms) path.arm(cx, cz, dx, dz, 0, HALF, PATH_W);
      continue;
    }

    // Carretera
    const roadArms = DIRS.filter(([dx, dz]) => neighbor(i, j, dx, dz)?.type === 'road');
    sidewalk.disc(cx, cz, ROAD_W / 2 + SIDEWALK);
    for (const [dx, dz] of roadArms) sidewalk.arm(cx, cz, dx, dz, 0, HALF, ROAD_W + 2 * SIDEWALK);

    road.disc(cx, cz, ROAD_W / 2);
    for (const [dx, dz] of arms) road.arm(cx, cz, dx, dz, 0, HALF, ROAD_W);

    // Línea central discontinua en cada brazo de carretera (fuera del cruce)
    for (const [dx, dz] of roadArms) lines.arm(cx, cz, dx, dz, ROAD_W / 2 + 0.5, ROAD_W / 2 + 3.5, 0.3);

    // Coche en uno de los brazos, por el carril derecho
    const r = seeded(i * 91.3 + j * 47.9);
    if (roadArms.length > 0 && r < 0.45) {
      const [dx, dz] = roadArms[Math.floor(seeded(i * 13.7 + j * 29.1) * roadArms.length)];
      const along = 8;
      const lane = 2.6;
      const x = cx + dx * along - dz * lane;
      const z = cz + dz * along + dx * lane;
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(4, 1.2, 2),
        new THREE.MeshLambertMaterial({ color: CAR_COLORS[Math.floor(seeded(i * 7.1 + j * 3.3) * CAR_COLORS.length)], flatShading: true }),
      );
      car.position.set(x, 0.6, z);
      car.rotation.y = Math.atan2(-dz, dx);
      cars.push(car);
    }
  }

  const add = (mesh: THREE.Mesh | null) => { if (mesh) group.add(mesh); };
  add(surfaceMesh(sidewalk.geometry(), COLORS.sidewalk));
  add(surfaceMesh(road.geometry(), COLORS.road));
  add(surfaceMesh(path.geometry(), COLORS.path));
  add(surfaceMesh(lines.geometry(), COLORS.line));
  cars.forEach((c) => group.add(c));
  return group;
}

/** Entorno: parques con árboles, carreteras y caminos unidos, y edificios en 3D. */
export function buildEnvironment(env: Record<string, EnvCell>): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4f2a, flatShading: true });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f855a, flatShading: true });

  for (const [key, cell] of Object.entries(env)) {
    if (cell.type === 'road' || cell.type === 'path') continue;
    const [i, j] = key.split(',').map(Number);
    const cx = cellCenter(i);
    const cz = cellCenter(j);

    if (cell.type === 'building') {
      const h = cell.height ?? 12;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(ENV_CELL - 2, h, ENV_CELL - 2),
        new THREE.MeshLambertMaterial({ color: cell.color ?? '#d6d3cd', flatShading: true }),
      );
      mesh.position.set(cx, h / 2, cz);
      group.add(mesh);
      continue;
    }

    // Parque
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(ENV_CELL, ENV_CELL),
      new THREE.MeshLambertMaterial({ color: COLORS.park }),
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(cx, -0.03, cz);
    group.add(tile);

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
