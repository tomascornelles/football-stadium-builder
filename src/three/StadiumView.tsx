import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { actions, getState, subscribe } from '../store';
import { MODULE_IDS, ModuleId } from '../types';
import {
  Anchors,
  buildApron,
  buildJunctions,
  buildModuleStructures,
  buildStandGroup,
  computeAnchors,
  hitboxMesh,
  layoutBaseHeights,
  moduleExtent,
  tallestStand,
} from '../geometry/modules';
import { buildPitch } from './pitch';
import { buildEnvironment, buildGridLines } from '../geometry/environment';
import { cellFromPoint } from '../environment';
import { registerCapture } from '../capture';

const VIEW_HALF_H = 110;
const VIEW_HALF_W = 130;
const ROTATE_SPEED = 0.12;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

function disposeGroup(group: THREE.Object3D) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) (mesh.material as THREE.Material).dispose();
  });
}

export function StadiumView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current!;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 2000);
    camera.position.set(200, 200, 200);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(-80, 160, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    const shadowCam = sun.shadow.camera as THREE.OrthographicCamera;
    shadowCam.left = -180;
    shadowCam.right = 180;
    shadowCam.top = 180;
    shadowCam.bottom = -180;
    shadowCam.near = 10;
    shadowCam.far = 700;
    shadowCam.updateProjectionMatrix();
    // Luz del estadio: un foco cálido sobre el campo, solo de noche
    const stadiumLight = new THREE.PointLight(0xffe4b5, 0, 420, 1);
    stadiumLight.position.set(0, 70, 0);
    scene.add(ambient, sun, stadiumLight);

    // Proyecta y recibe sombras en todo el objeto
    const shadowsOn = (obj: THREE.Object3D) => {
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
    };

    let lastNight: boolean | null = null;
    const applyLighting = (night: boolean) => {
      if (night) {
        ambient.color.set(0x8fa6d4);
        ambient.intensity = 0.28;
        sun.color.set(0x9db4ff);
        sun.intensity = 0.15;
        sun.castShadow = false;
        stadiumLight.intensity = 3;
        scene.background = new THREE.Color(0x060b16);
      } else {
        ambient.color.set(0xffffff);
        ambient.intensity = 0.7;
        sun.color.set(0xffffff);
        sun.intensity = 0.9;
        sun.castShadow = true;
        stadiumLight.intensity = 0;
        scene.background = null;
      }
    };

    const world = new THREE.Group();
    scene.add(world);
    world.add(buildPitch());

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshLambertMaterial({ color: 0x1b2a3d }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    world.add(ground);

    const hitboxes = new Map<ModuleId, THREE.Mesh>();
    let hitboxKey = '';
    let apron: THREE.Mesh | null = null;
    let apronKey = '';

    const standGroup = new THREE.Group();
    const structureGroup = new THREE.Group();
    const junctionGroup = new THREE.Group();
    world.add(structureGroup, standGroup, junctionGroup);

    const envGroup = new THREE.Group();
    const gridLines = buildGridLines();
    gridLines.visible = false;
    let envKey = '';
    world.add(envGroup, gridLines);

    interface StandEntry { group: THREE.Group; key: string }
    interface StructureEntry { group: THREE.Group; key: string }
    const entries = new Map<string, StandEntry>();
    const structures = new Map<ModuleId, StructureEntry>();
    let junctionKey = '';

    let targetAngle = 0;
    let frameId = 0;
    let zoom = 1;

    /** Sincroniza la escena con el estado. Solo reconstruye lo que cambia. */
    function sync() {
      const st = getState();
      const bases = layoutBaseHeights(st.stands);
      const anchors: Anchors = computeAnchors(st.stands);
      // Las esquinas dependen de las filas de sus vecinos: la clave incluye todas las gradas
      const anchorKey = JSON.stringify([anchors, st.stands.map((x) => [x.moduleId, x.order, x.offset, x.curve, x.height, x.tilt])]);
      const alive = new Set<string>();

      // Césped entre gradas y campo
      if (anchorKey !== apronKey) {
        apronKey = anchorKey;
        if (apron) {
          world.remove(apron);
          disposeGroup(apron);
        }
        apron = buildApron(anchors);
        apron.receiveShadow = true;
        world.add(apron);
      }

      // Módulos de selección: siguen la curva de cada módulo
      if (anchorKey !== hitboxKey) {
        hitboxKey = anchorKey;
        hitboxes.forEach((m) => {
          world.remove(m);
          disposeGroup(m);
        });
        hitboxes.clear();
        for (const id of MODULE_IDS) {
          const m = hitboxMesh(id, anchors);
          world.add(m);
          hitboxes.set(id, m);
        }
      }

      // Gradas
      for (const s of st.stands) {
        alive.add(s.id);
        const base = bases.get(s.id) ?? 0;
        const key = `${s.moduleId}|${s.height}|${s.tilt}|${s.offset}|${base}|${s.columns}|${s.railing}|${s.curve}|${anchorKey}`;
        let entry = entries.get(s.id);

        if (!entry || entry.key !== key) {
          if (entry) {
            standGroup.remove(entry.group);
            disposeGroup(entry.group);
          }
          const group = buildStandGroup(s, base, anchors, st.stands);
          shadowsOn(group);
          standGroup.add(group);
          entry = { group, key };
          entries.set(s.id, entry);
        }

        const selected = s.id === st.selectedStandId;
        entry.group.children.forEach((child) => {
          if (!child.userData.isTier) return;
          const mat = (child as THREE.Mesh).material as THREE.MeshLambertMaterial;
          mat.color.set(s.color);
          mat.emissive.set(selected ? 0x3a3a3a : 0x000000);
        });
      }

      for (const [id, entry] of entries) {
        if (!alive.has(id)) {
          standGroup.remove(entry.group);
          disposeGroup(entry.group);
          entries.delete(id);
        }
      }

      // Exteriores por módulo
      for (const id of MODULE_IDS) {
        const ext = st.exteriors[id];
        const extent = moduleExtent(st.stands, id);
        const tallest = tallestStand(st.stands, id, anchors);
        const key = JSON.stringify([ext, extent, anchorKey, tallest]);
        const current = structures.get(id);
        if (!current || current.key !== key) {
          if (current) {
            structureGroup.remove(current.group);
            disposeGroup(current.group);
          }
          const group = buildModuleStructures(id, ext, extent, anchors, tallest);
          shadowsOn(group);
          structureGroup.add(group);
          structures.set(id, { group, key });
        }
      }

      // Muros de unión
      const extents = {} as Record<ModuleId, ReturnType<typeof moduleExtent>>;
      for (const id of MODULE_IDS) extents[id] = moduleExtent(st.stands, id);
      const jKey = JSON.stringify([st.exteriors, extents, anchorKey]);
      if (jKey !== junctionKey) {
        junctionKey = jKey;
        disposeGroup(junctionGroup);
        junctionGroup.clear();
        const jg = buildJunctions(st.exteriors, extents, anchors);
        shadowsOn(jg);
        junctionGroup.add(jg);
      }

      // Entorno: cuadrícula y celdas pintadas
      const night = st.lighting === 'night';
      if (night !== lastNight) {
        lastNight = night;
        applyLighting(night);
      }
      const envJson = JSON.stringify([st.environment, night]);
      if (envJson !== envKey) {
        envKey = envJson;
        disposeGroup(envGroup);
        envGroup.clear();
        const eg = buildEnvironment(st.environment, night);
        shadowsOn(eg);
        envGroup.add(eg);
      }
      gridLines.visible = st.mode === 'environment';

      hitboxes.forEach((mesh, id) => {
        (mesh.material as THREE.MeshBasicMaterial).opacity = id === st.selectedModule && st.mode === 'stadium' ? 0.25 : 0;
      });

      targetAngle = st.rotationSteps * (Math.PI / 2);
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const diff = targetAngle - world.rotation.y;
      if (Math.abs(diff) > 1e-4) world.rotation.y += diff * ROTATE_SPEED;
      else world.rotation.y = targetAngle;
      renderer.render(scene, camera);
    }

    function resize() {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h);
      const aspect = w / h;
      const halfH = Math.max(VIEW_HALF_H, VIEW_HALF_W / aspect);
      camera.left = -halfH * aspect;
      camera.right = halfH * aspect;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const applyZoom = (z: number) => {
      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    };

    // Selección y gestos: pulsación sin arrastre, pellizco con dos punteros
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const canvas = renderer.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number } | null = null;
    let pinchDist = 0;

    const pointerDistance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const pick = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const targets: THREE.Object3D[] = [standGroup, ...hitboxes.values()];
      const hit = raycaster.intersectObjects(targets, true)[0];
      if (!hit) {
        actions.selectStand(null);
        return;
      }
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData.standId) obj = obj.parent;
      if (obj) {
        actions.selectStand(obj.userData.standId as string);
      } else if (hit.object.userData.moduleId) {
        actions.selectModule(hit.object.userData.moduleId as ModuleId);
      }
    };

    // Pintado sobre la cuadrícula (modo entorno)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let painting = false;
    let lastCell = '';
    const paintAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
      const local = world.worldToLocal(hit);
      const cell = cellFromPoint(local.x, local.z);
      if (!cell) return;
      const key = `${cell.i},${cell.j}`;
      if (key === lastCell) return;
      lastCell = key;
      actions.paintCell(cell.i, cell.j);
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        down = { x: e.clientX, y: e.clientY };
        if (getState().mode === 'environment') {
          painting = true;
          lastCell = '';
          paintAt(e.clientX, e.clientY);
        }
      } else {
        down = null;
        painting = false;
        pinchDist = pointerDistance();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (painting && pointers.size === 1) paintAt(e.clientX, e.clientY);
      if (pointers.size === 2) {
        const d = pointerDistance();
        if (pinchDist > 0 && d > 0) applyZoom(zoom * (d / pinchDist));
        pinchDist = d;
        down = null;
      }
    };

    const onUp = (e: PointerEvent) => {
      const single = pointers.size === 1 && pointers.has(e.pointerId);
      pointers.delete(e.pointerId);
      painting = false;
      const start = down;
      down = null;
      if (!single || !start) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved > 8) return;
      if (getState().mode === 'stadium') pick(e.clientX, e.clientY);
    };

    const onCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      painting = false;
      down = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(zoom * Math.exp(-e.deltaY * 0.0015));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    registerCapture(() => {
      renderer.render(scene, camera);
      return renderer.domElement;
    });

    const unsubscribe = subscribe(sync);
    sync();
    animate();

    return () => {
      registerCapture(null);
      unsubscribe();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onCancel);
      canvas.removeEventListener('wheel', onWheel);
      entries.forEach((e) => disposeGroup(e.group));
      structures.forEach((e) => disposeGroup(e.group));
      hitboxes.forEach((m) => disposeGroup(m));
      disposeGroup(junctionGroup);
      disposeGroup(envGroup);
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className="stage-canvas" />;
}
