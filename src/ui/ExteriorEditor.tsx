import { useState } from 'react';
import { actions } from '../store';
import {
  DECO_OPTIONS,
  DEFAULT_EXTERIOR,
  FLOOD_OPTIONS,
  ModuleExterior,
  ModuleId,
  ROOF_DECO_OPTIONS,
  ROOF_OPTIONS,
  SCORE_OPTIONS,
  TOWER_POS_OPTIONS,
  TowerPos,
} from '../types';
import { Slider } from './Slider';
import { Toggle } from './Toggle';
import { ApplyRow, ColorField, Select } from './fields';

const keys = (...k: (keyof ModuleExterior)[]) => k;

export function ExteriorEditor({ moduleId, ext }: { moduleId: ModuleId; ext: ModuleExterior }) {
  const set = (patch: Partial<ModuleExterior>) => actions.setExterior(moduleId, patch);
  const applyBlock = (list: (keyof ModuleExterior)[]) => () => actions.applyExteriorKeys(moduleId, list);
  const allKeys = Object.keys(DEFAULT_EXTERIOR) as (keyof ModuleExterior)[];
  // Acordeón: solo un apartado abierto a la vez
  const [active, setActive] = useState<string>('Cubierta');
  const acc = (name: string) => ({
    open: active === name,
    onToggle: (e: React.SyntheticEvent<HTMLDetailsElement>) => {
      if (e.currentTarget.open) setActive(name);
    },
  });

  const roofKeys = keys(
    'roof', 'roofHeight', 'roofOverhang', 'roofWidth', 'roofInset', 'roofThickness', 'roofSlope',
    'roofAngle', 'roofColumns', 'roofColor', 'roofDeco', 'roofDecoCount', 'roofDecoHeight', 'roofDecoColor',
  );

  return (
    <section className="editor">
      <h2 className="section-title">Exteriores y detalles</h2>

      <details className="sub" {...acc('Cubierta')}>
        <summary>Cubierta</summary>
        <Select label="Tipo" value={ext.roof} options={ROOF_OPTIONS} onChange={(v) => set({ roof: v })} />
        {ext.roof !== 'none' && (
          <>
            <Slider label="Altura sobre gradas" unit="m" value={ext.roofHeight} min={1} max={20} step={0.5}
              onChange={(v) => set({ roofHeight: v })} />
            <Slider label="Ancho (0 = automático)" unit="m" value={ext.roofWidth} min={0} max={80} step={1}
              onChange={(v) => set({ roofWidth: v })} />
            <Slider label="Extensión interior" unit="m" value={ext.roofInset} min={0} max={40} step={1}
              onChange={(v) => set({ roofInset: v })} />
            <Slider label="Vuelo" unit="m" value={ext.roofOverhang} min={0} max={12} step={1}
              onChange={(v) => set({ roofOverhang: v })} />
            <Slider label="Grosor" unit="m" value={ext.roofThickness} min={0.5} max={3} step={0.5}
              onChange={(v) => set({ roofThickness: v })} />
            {ext.roof === 'cantilever' && (
              <Slider label="Inclinación" unit="°" hint="(+ sube hacia fuera)" value={ext.roofAngle}
                min={-20} max={20} step={1} onChange={(v) => set({ roofAngle: v })} />
            )}
            {ext.roof === 'arch' && (
              <Slider label="Flecha" unit="°" value={ext.roofSlope} min={0} max={25} step={1}
                onChange={(v) => set({ roofSlope: v })} />
            )}
            <Toggle label="Pilares de apoyo" checked={ext.roofColumns} onChange={(v) => set({ roofColumns: v })} />
            <ColorField label="Color" value={ext.roofColor} onChange={(v) => set({ roofColor: v })} />
            <Select label="Decoración sobre cubierta" value={ext.roofDeco} options={ROOF_DECO_OPTIONS}
              onChange={(v) => set({ roofDeco: v })} />
            {ext.roofDeco !== 'none' && (
              <>
                <Slider label="Cantidad" unit="" value={ext.roofDecoCount} min={1} max={12} step={1}
                  onChange={(v) => set({ roofDecoCount: v })} />
                <Slider label="Altura" unit="m" value={ext.roofDecoHeight} min={2} max={20} step={1}
                  onChange={(v) => set({ roofDecoHeight: v })} />
                <ColorField label="Color de decoración" value={ext.roofDecoColor}
                  onChange={(v) => set({ roofDecoColor: v })} />
              </>
            )}
          </>
        )}
        <ApplyRow allLabel="Cubierta a todos los módulos" onAll={applyBlock(roofKeys)} />
      </details>

      <details className="sub" {...acc('Iluminación')}>
        <summary>Iluminación</summary>
        <Select label="Tipo" value={ext.flood} options={FLOOD_OPTIONS} onChange={(v) => set({ flood: v })} />
        {ext.flood !== 'none' && (
          <>
            {ext.flood === 'mast' && (
              <>
                <Slider label="Número de torres" unit="" value={ext.floodCount} min={1} max={4} step={1}
                  onChange={(v) => set({ floodCount: v })} />
                <Slider label="Altura de torres" unit="m" value={ext.floodHeight} min={8} max={60} step={1}
                  onChange={(v) => set({ floodHeight: v })} />
              </>
            )}
            <ColorField label="Color de luz" value={ext.floodColor} onChange={(v) => set({ floodColor: v })} />
          </>
        )}
        <ApplyRow allLabel="Iluminación a todos los módulos"
          onAll={applyBlock(keys('flood', 'floodCount', 'floodHeight', 'floodColor'))} />
      </details>

      <details className="sub" {...acc('Marcador')}>
        <summary>Marcador</summary>
        <Select label="Tipo" value={ext.score} options={SCORE_OPTIONS} onChange={(v) => set({ score: v })} />
        {ext.score === 'marquesina' && ext.roof === 'none' && (
          <p className="hint-text">El marcador de marquesina necesita una cubierta.</p>
        )}
        {(ext.score === 'marcador' || ext.score === 'pantalla') && (
          <>
            <Slider label="Altura sobre la grada" unit="m" value={ext.scoreHeight} min={4} max={40} step={1}
              onChange={(v) => set({ scoreHeight: v })} />
            <Slider label="Ancho del panel" unit="m" value={ext.scoreWidth} min={2} max={20} step={1}
              onChange={(v) => set({ scoreWidth: v })} />
          </>
        )}
        <ApplyRow allLabel="Marcador a todos los módulos"
          onAll={applyBlock(keys('score', 'scoreHeight', 'scoreWidth'))} />
      </details>

      <details className="sub" {...acc('Decoración')}>
        <summary>Decoración</summary>
        <Select label="Tipo" value={ext.deco} options={DECO_OPTIONS} onChange={(v) => set({ deco: v })} />
        {ext.deco !== 'none' && (
          <>
            <Slider label={ext.deco === 'towers' ? 'Número de torres' : 'Cantidad'} unit="" value={ext.decoCount}
              min={1} max={12} step={1} onChange={(v) => set({ decoCount: v })} />
            <Slider label={ext.deco === 'arches' ? 'Altura de arcos' : 'Altura'} unit="m" value={ext.decoHeight}
              min={4} max={60} step={1} onChange={(v) => set({ decoHeight: v })} />
            <ColorField label="Color" value={ext.decoColor} onChange={(v) => set({ decoColor: v })} />
          </>
        )}

        <Toggle label="Escaleras exteriores en zigzag" checked={ext.stairs}
          onChange={(v) => set({ stairs: v })} />
        <p className="hint-text">3 escaleras en laterales y fondos, 1 en esquinas. Tramos de 5 m.</p>

        <Slider label="Torres de escaleras" unit="" value={ext.circleTowers} min={0} max={3} step={1}
          onChange={(v) => set({ circleTowers: v })} />
        {ext.circleTowers > 0 && (
          <>
            {ext.circleTowers === 1 && (
              <Select<TowerPos> label="Posición" value={ext.circleTowerPos} options={TOWER_POS_OPTIONS}
                onChange={(v) => set({ circleTowerPos: v })} />
            )}
            <Slider label="Altura de torres" unit="m" value={ext.circleTowerHeight} min={8} max={60} step={1}
              onChange={(v) => set({ circleTowerHeight: v })} />
            <ColorField label="Color de torres" value={ext.circleTowerColor}
              onChange={(v) => set({ circleTowerColor: v })} />
          </>
        )}

        <ApplyRow allLabel="Decoración, escaleras y torres a todos los módulos"
          onAll={applyBlock(keys('deco', 'decoCount', 'decoHeight', 'decoColor',
            'stairs', 'circleTowers', 'circleTowerHeight', 'circleTowerPos', 'circleTowerColor'))} />
      </details>

      <ApplyRow allLabel="Todos los exteriores a todos los módulos" onAll={() => actions.applyExteriorKeys(moduleId, allKeys)} />
    </section>
  );
}
