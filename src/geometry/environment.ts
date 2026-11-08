import * as THREE from 'three';
import { EnvCell } from '../types';
import { ENV_CELL, ENV_HALF, ENV_N } from '../config';

const TILE_COLORS: Record<'road' | 'path' | 'park', number> = {
  road: 0x4b5563,
  path: 0xd6c7a1,
  park: 0x4f9d4f,
};

/** Número pseudoaleatorio estable (los árboles no cambian entre renderizados). */
const seeded = (n: number) => {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
};

const cellCenter = (i: number) => -ENV_HALF + (i + 0.5) * ENV_CELL;

/** Entorno: carreteras, caminos y parques planos; edificios y árboles en 3D. */
export function buildEnvironment(env: Record<string, EnvCell>): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4f2a, flatShading: true });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f855a, flatShading: true });

  for (const [key, cell] of Object.entries(env)) {
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

    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(ENV_CELL, ENV_CELL),
      new THREE.MeshLambertMaterial({ color: TILE_COLORS[cell.type] }),
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
