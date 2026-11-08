import * as THREE from 'three';
import { PITCH_LENGTH, PITCH_WIDTH } from '../config';

const HL = PITCH_LENGTH / 2;
const HW = PITCH_WIDTH / 2;

function grassTexture(): THREE.CanvasTexture {
  // Franjas de corte: dos píxeles repetidos para un look pixel art.
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3f9a45';
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = '#37893d';
  ctx.fillRect(1, 0, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });

function line(points: [number, number][], closed = true): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(
    points.map(([x, z]) => new THREE.Vector3(x, 0.03, z)),
  );
  return closed ? new THREE.LineLoop(geo, lineMat) : new THREE.Line(geo, lineMat);
}

function circle(cx: number, cz: number, r: number, seg = 64): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

/** Campo de dimensiones fijas centrado en el origen. */
export function buildPitch(): THREE.Group {
  const g = new THREE.Group();

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_LENGTH, PITCH_WIDTH),
    new THREE.MeshLambertMaterial({ map: grassTexture() }),
  );
  grass.rotation.x = -Math.PI / 2;
  g.add(grass);

  // Línea de banda y de fondo
  g.add(line([[-HL, -HW], [HL, -HW], [HL, HW], [-HL, HW]]));
  // Línea central y círculo central
  g.add(line([[0, -HW], [0, HW]], false));
  g.add(line(circle(0, 0, 9.15)));
  g.add(line(circle(0, 0, 0.3, 12)));

  for (const s of [-1, 1]) {
    const x0 = s * HL;
    // Área grande
    g.add(line([[x0, -20.15], [x0 - s * 16.5, -20.15], [x0 - s * 16.5, 20.15], [x0, 20.15]], false));
    // Área pequeña
    g.add(line([[x0, -9.16], [x0 - s * 5.5, -9.16], [x0 - s * 5.5, 9.16], [x0, 9.16]], false));
    // Punto de penalti
    g.add(line(circle(s * (HL - 11), 0, 0.3, 12)));
    // Portería
    const goal = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2.44, 7.32),
      new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }),
    );
    goal.position.set(s * (HL + 1.2), 1.22, 0);
    g.add(goal);
  }

  return g;
}
