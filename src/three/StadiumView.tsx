import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { actions, getState, subscribe } from '../store';
import { MODULE_IDS, ModuleId } from '../types';
import {
  Anchors,
  buildApron,
  buildModuleStructures,
  buildStandGroup,
  computeAnchors,
  hitboxMesh,
  layoutBaseHeights,
  moduleExtent,
  pillarLine,
  tallestStand,
} from '../geometry/modules';
import { buildPitch } from './pitch';
import { buildEnvironment, buildGridLines } from '../geometry/environment';
import { cellFromPoint } from '../environment';
import { ENV_CELL, ENV_HALF } from '../config';
import { isSelectionHidden, registerCapture } from '../capture';

const VIEW_HALF_H = 110;
const VIEW_HALF_W = 130;
const ROTATE_SPEED = 0.12;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
/** Altura de los ojos (m) en la vista interior, desde el centro del campo. */
const EYE_HEIGHT = 1.7;
/** Velocidad al caminar por el campo (m/s) y límites del paseo (medio campo, con margen). */
const WALK_SPEED = 12;
const WALK_HALF_LENGTH = 51;
const WALK_HALF_WIDTH = 33;

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
    // Vista interior: cámara en perspectiva en el centro del campo, con la mirada girada por arrastre
    const lookCam = new THREE.PerspectiveCamera(60, 1, 0.3, 2000);
    lookCam.rotation.order = 'YXZ';
    lookCam.position.set(0, EYE_HEIGHT, 0);
    let lookYaw = 0;
    let lookPitch = 0;
    let lastFrame = performance.now();
    // Teclas de flecha mantenidas, para caminar en la vista interior
    const heldKeys = new Set<string>();
    const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const onKeyDown = (e: KeyboardEvent) => {
      if (getState().view !== 'inside' || !ARROWS.includes(e.key)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      heldKeys.add(e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => heldKeys.delete(e.key);
    const onBlur = () => heldKeys.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    const activeCam = () => (getState().view === 'inside' ? lookCam : camera);
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

    // Focos del estadio: proyectores de noche que apuntan al centro del campo (limitados a 8)
    const FLOOD_LIGHTS = 8;
    const floodTarget = new THREE.Object3D();
    floodTarget.position.set(0, 0, 0);
    scene.add(floodTarget);
    const floodLights: THREE.SpotLight[] = [];
    const roofLights: THREE.SpotLight[] = [];
    for (let k = 0; k < FLOOD_LIGHTS; k++) {
      const l = new THREE.SpotLight(0xfff1c1, 0, 170, 0.9, 0.5, 2);
      l.target = floodTarget;
      scene.add(l);
      floodLights.push(l);
      const r = new THREE.SpotLight(0xfff3d1, 0, 170, 1.0, 0.6, 2);
      r.target = floodTarget;
      scene.add(r);
      roofLights.push(r);
    }

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
    let lastView: string | null = null;
    let lastSteps: number | null = null;
    // Vista exterior libre: ángulos de la cámara isométrica alrededor del estadio
    const ISO_DIST = Math.hypot(200, 200, 200);
    const ISO_AZIMUTH = Math.PI / 4;
    const ISO_ELEVATION = Math.asin(200 / ISO_DIST);
    let orbitAz = ISO_AZIMUTH;
    let orbitEl = ISO_ELEVATION;
    const applyOrbit = () => {
      camera.position.set(
        ISO_DIST * Math.cos(orbitEl) * Math.sin(orbitAz),
        ISO_DIST * Math.sin(orbitEl),
        ISO_DIST * Math.cos(orbitEl) * Math.cos(orbitAz),
      );
      camera.lookAt(0, 0, 0);
    };
    const resetOrbit = () => {
      orbitAz = ISO_AZIMUTH;
      orbitEl = ISO_ELEVATION;
      applyOrbit();
    };

    const headPos = new THREE.Vector3();
    /** Coloca cada luz de un grupo sobre su marcador (cabezal de foco o fanal de marquesina). */
    const updatePool = (pool: THREE.SpotLight[], marker: string, night: boolean, intensity: number) => {
      const found: THREE.Object3D[] = [];
      structureGroup.traverse((o) => {
        if (o.userData[marker]) {
          found.push(o);
          // La luz de marquesina solo se ve de noche
          if (marker === 'roofLight') o.visible = night;
        }
      });
      pool.forEach((l, k) => {
        const h = found[k];
        if (night && h) {
          h.getWorldPosition(headPos);
          l.position.copy(headPos);
          l.color.set(h.userData.lightColor as string);
          l.intensity = intensity;
        } else {
          l.intensity = 0;
        }
      });
    };
    const updateFloodLights = (night: boolean) => {
      scene.updateMatrixWorld(true);
      updatePool(floodLights, 'floodHead', night, 3600);
      updatePool(roofLights, 'roofLight', night, 1800);
    };
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
    const pitch = buildPitch();
    // El campo recibe la sombra de las gradas y de los focos
    pitch.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true;
    });
    world.add(pitch);

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

    // Celda bajo el ratón en modo entorno
    const hoverTile = new THREE.Mesh(
      new THREE.PlaneGeometry(ENV_CELL, ENV_CELL),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    hoverTile.rotation.x = -Math.PI / 2;
    hoverTile.position.y = 0.02;
    hoverTile.visible = false;
    hoverTile.renderOrder = 10;
    world.add(hoverTile);

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
        const key = `${s.moduleId}|${s.height}|${s.tilt}|${s.offset}|${base}|${s.railing}|${s.curve}|${s.aisleColor}|${JSON.stringify(s.facade)}|${anchorKey}`;
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

        const selected = !isSelectionHidden() && s.id === st.selectedStandId;
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
        const line = pillarLine(st.stands, id);
        const key = JSON.stringify([ext, extent, anchorKey, tallest, line?.u ?? 0]);
        const current = structures.get(id);
        if (!current || current.key !== key) {
          if (current) {
            structureGroup.remove(current.group);
            disposeGroup(current.group);
          }
          const group = buildModuleStructures(id, ext, extent, anchors, tallest, line);
          shadowsOn(group);
          structureGroup.add(group);
          structures.set(id, { group, key });
        }
      }

      // Entorno: cuadrícula y celdas pintadas
      if (st.view !== lastView) {
        lastView = st.view;
        if (st.view === 'inside') {
          lookCam.position.set(0, EYE_HEIGHT, 0);
          lookCam.rotation.set(lookPitch, lookYaw, 0);
        } else if (st.view === 'top') {
          camera.up.set(0, 0, -1);
          camera.position.set(0, 300, 0.001);
        } else {
          camera.up.set(0, 1, 0);
          resetOrbit();
        }
        camera.lookAt(0, 0, 0);
      }
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
        (mesh.material as THREE.MeshBasicMaterial).opacity = id === st.selectedModule && st.mode === 'stadium' && !isSelectionHidden() ? 0.25 : 0;
      });

      // Luces de los focos, colocadas en los cabezales del estadio
      updateFloodLights(night);

      // Girar con las flechas recoloca la vista exterior en isométrica
      if (st.rotationSteps !== lastSteps) {
        lastSteps = st.rotationSteps;
        if (st.view === 'iso') resetOrbit();
      }
      targetAngle = st.rotationSteps * (Math.PI / 2);
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      if (getState().view === 'inside' && heldKeys.size > 0) {
        // Avanzar hacia donde se mira (flechas arriba/abajo) y desplazarse de lado (izquierda/derecha)
        const fwd = (heldKeys.has('ArrowUp') ? 1 : 0) - (heldKeys.has('ArrowDown') ? 1 : 0);
        const side = (heldKeys.has('ArrowRight') ? 1 : 0) - (heldKeys.has('ArrowLeft') ? 1 : 0);
        if (fwd !== 0 || side !== 0) {
          const step = WALK_SPEED * dt;
          const sinY = Math.sin(lookYaw);
          const cosY = Math.cos(lookYaw);
          lookCam.position.x += (-sinY * fwd + cosY * side) * step;
          lookCam.position.z += (-cosY * fwd - sinY * side) * step;
          lookCam.position.x = Math.min(WALK_HALF_LENGTH, Math.max(-WALK_HALF_LENGTH, lookCam.position.x));
          lookCam.position.z = Math.min(WALK_HALF_WIDTH, Math.max(-WALK_HALF_WIDTH, lookCam.position.z));
        }
      }
      const diff = targetAngle - world.rotation.y;
      const rotating = Math.abs(diff) > 1e-4;
      if (rotating) world.rotation.y += diff * ROTATE_SPEED;
      else world.rotation.y = targetAngle;
      // Las luces siguen la posición de sus cabezales: al girar hay que recolocarlas
      if (rotating && lastNight) updateFloodLights(true);
      renderer.render(scene, activeCam());
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
      lookCam.aspect = aspect;
      lookCam.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const applyZoom = (z: number) => {
      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    };
    // En la vista interior el zoom cambia el campo de visión; en las demás, el zoom de la cámara
    const zoomBy = (factor: number) => {
      if (getState().view === 'inside') {
        lookCam.fov = Math.min(100, Math.max(25, lookCam.fov / factor));
        lookCam.updateProjectionMatrix();
      } else {
        applyZoom(zoom * factor);
      }
    };
    const lookAround = (dx: number, dy: number) => {
      lookYaw -= dx * 0.004;
      lookPitch = Math.min(1.3, Math.max(-1.3, lookPitch - dy * 0.004));
      lookCam.rotation.set(lookPitch, lookYaw, 0);
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

    const showHover = (clientX: number, clientY: number) => {
      if (getState().mode !== 'environment') {
        hoverTile.visible = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) {
        hoverTile.visible = false;
        return;
      }
      const local = world.worldToLocal(hit);
      const cell = cellFromPoint(local.x, local.z);
      if (!cell) {
        hoverTile.visible = false;
        return;
      }
      hoverTile.position.set(-ENV_HALF + (cell.i + 0.5) * ENV_CELL, 0.02, -ENV_HALF + (cell.j + 0.5) * ENV_CELL);
      hoverTile.visible = true;
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        down = { x: e.clientX, y: e.clientY };
        if (getState().mode === 'environment' && getState().view !== 'inside') {
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
      if (!pointers.has(e.pointerId)) {
        if (getState().view !== 'inside') showHover(e.clientX, e.clientY);
        return;
      }
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Vista exterior: arrastrar gira la cámara alrededor del estadio
      if (getState().view === 'iso' && getState().mode === 'stadium' && pointers.size === 1) {
        orbitAz -= (e.clientX - prev.x) * 0.008;
        orbitEl = Math.min(1.5, Math.max(0.15, orbitEl + (e.clientY - prev.y) * 0.006));
        applyOrbit();
        down = null;
        return;
      }
      if (getState().view === 'inside' && pointers.size === 1) {
        lookAround(e.clientX - prev.x, e.clientY - prev.y);
        down = null;
        return;
      }
      if (painting && pointers.size === 1) paintAt(e.clientX, e.clientY);
      if (pointers.size === 2) {
        const d = pointerDistance();
        if (pinchDist > 0 && d > 0) zoomBy(d / pinchDist);
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
      if (getState().mode === 'stadium' && getState().view !== 'inside') pick(e.clientX, e.clientY);
    };

    const onCancel = (e: PointerEvent) => {
      hoverTile.visible = false;
      pointers.delete(e.pointerId);
      painting = false;
      down = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    registerCapture(
      () => {
        // Sin módulo ni grada destacados: sync() lee isSelectionHidden()
        sync();
        renderer.render(scene, activeCam());
        return renderer.domElement;
      },
      () => sync(),
    );

    const unsubscribe = subscribe(sync);
    sync();
    animate();

    return () => {
      registerCapture(null);
      unsubscribe();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
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
