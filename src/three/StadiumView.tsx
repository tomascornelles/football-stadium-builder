import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { actions, getState, subscribe } from '../store';
import { MODULE_IDS, ModuleId } from '../types';
import {
  MODULE_FRAMES,
  buildJunctions,
  buildModuleStructures,
  buildStandGroup,
  hitboxFor,
  layoutBaseHeights,
  moduleExtent,
} from '../geometry/modules';
import { buildPitch } from './pitch';

const VIEW_HALF_H = 110;
const VIEW_HALF_W = 130;
const ROTATE_SPEED = 0.12;

interface StandEntry {
  group: THREE.Group;
  key: string;
}

interface StructureEntry {
  group: THREE.Group;
  key: string;
}

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Cámara ortográfica con perspectiva isométrica
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 2000);
    camera.position.set(200, 200, 200);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(-80, 160, 60);
    scene.add(sun);

    // Mundo: todo lo que gira con el estadio
    const world = new THREE.Group();
    scene.add(world);
    world.add(buildPitch());

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshLambertMaterial({ color: 0x1b2a3d }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    world.add(ground);

    // Zonas de selección de módulos (visibles al seleccionar)
    const hitboxes = new Map<ModuleId, THREE.Mesh>();
    for (const id of MODULE_IDS) {
      const { geometry, position, rotationY } = hitboxFor(MODULE_FRAMES[id]);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.position.copy(position);
      mesh.rotation.y = rotationY;
      mesh.userData.moduleId = id;
      world.add(mesh);
      hitboxes.set(id, mesh);
    }

    const standGroup = new THREE.Group();
    const structureGroup = new THREE.Group();
    const junctionGroup = new THREE.Group();
    let junctionKey = '';
    world.add(structureGroup, standGroup, junctionGroup);
    const entries = new Map<string, StandEntry>();
    const structures = new Map<ModuleId, StructureEntry>();

    let targetAngle = 0;
    let frameId = 0;

    /** Sincroniza la escena con el estado. Solo reconstruye lo que cambia. */
    function sync() {
      const st = getState();
      const bases = layoutBaseHeights(st.stands);
      const alive = new Set<string>();

      for (const s of st.stands) {
        alive.add(s.id);
        const base = bases.get(s.id) ?? 0;
        const key = `${s.moduleId}|${s.height}|${s.tilt}|${s.offset}|${base}|${s.columns}|${s.railing}`;
        let entry = entries.get(s.id);

        if (!entry || entry.key !== key) {
          if (entry) {
            standGroup.remove(entry.group);
            disposeGroup(entry.group);
          }
          const group = buildStandGroup(s, base);
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

      // Exteriores: se reconstruyen solo si cambian sus datos o las gradas del módulo
      for (const id of MODULE_IDS) {
        const ext = st.exteriors[id];
        const extent = moduleExtent(st.stands, id);
        const key = JSON.stringify([ext, extent]);
        const current = structures.get(id);
        if (!current || current.key !== key) {
          if (current) {
            structureGroup.remove(current.group);
            disposeGroup(current.group);
          }
          const group = buildModuleStructures(id, ext, extent);
          structureGroup.add(group);
          structures.set(id, { group, key });
        }
      }

      const extents = {} as Record<ModuleId, ReturnType<typeof moduleExtent>>;
      for (const id of MODULE_IDS) extents[id] = moduleExtent(st.stands, id);
      const jKey = JSON.stringify([st.exteriors, extents]);
      if (jKey !== junctionKey) {
        junctionKey = jKey;
        disposeGroup(junctionGroup);
        junctionGroup.clear();
        junctionGroup.add(buildJunctions(st.exteriors, extents));
      }

      hitboxes.forEach((mesh, id) => {
        (mesh.material as THREE.MeshBasicMaterial).opacity = id === st.selectedModule ? 0.25 : 0;
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

    // Selección: pulsación sin arrastre, con ratón o táctil
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const canvas = renderer.domElement;

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 8) return;

      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
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
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    const unsubscribe = subscribe(sync);
    sync();
    animate();

    return () => {
      unsubscribe();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      entries.forEach((e) => disposeGroup(e.group));
      structures.forEach((e) => disposeGroup(e.group));
      hitboxes.forEach((m) => disposeGroup(m));
      disposeGroup(junctionGroup);
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className="stage-canvas" />;
}
