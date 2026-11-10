import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { actions, getState } from '../store';
import { LIMITS } from '../config';
import {
  COLUMN_OPTIONS,
  CURVE_OPTIONS,
  CurveType,
  FACADE_OPTIONS,
  FacadeKind,
  MODULE_IDS,
  MODULE_NAMES,
  ModuleId,
  Stand,
  StandFacade,
} from '../types';
import { Slider } from './Slider';
import { Toggle } from './Toggle';
import { ApplyRow, ColorField, Select } from './fields';
import { Dropdown } from './Dropdown';

const CORNER_IDS: ModuleId[] = ['nw', 'ne', 'sw', 'se'];

export function StandEditor({ stand }: { stand: Stand }) {
  const [target, setTarget] = useState<ModuleId | ''>('');
  const corner = CORNER_IDS.includes(stand.moduleId);
  const f = stand.facade;
  const panels = f.kind === 'vpanels' || f.kind === 'hpanels';
  const setFacade = (patch: Partial<StandFacade>) => actions.updateStand(stand.id, { facade: { ...f, ...patch } });

  return (
    <section className="editor">
      <h2 className="section-title">Grada seleccionada</h2>

      <Slider
        label="Altura" unit="m" value={stand.height}
        min={LIMITS.height.min} max={LIMITS.height.max} step={LIMITS.height.step}
        onChange={(v) => actions.updateStand(stand.id, { height: v })}
      />
      <Slider
        label="Inclinación" unit="°" value={stand.tilt}
        min={LIMITS.tilt.min} max={LIMITS.tilt.max} step={LIMITS.tilt.step}
        onChange={(v) => actions.updateStand(stand.id, { tilt: v })}
      />
      <Slider
        label="Desplazamiento" unit="m" hint="(+ fuera / − dentro)" value={stand.offset}
        min={LIMITS.offset.min} max={LIMITS.offset.max} step={LIMITS.offset.step}
        onChange={(v) => actions.updateStand(stand.id, { offset: v })}
      />
      {(
        <Select<CurveType>
          label="Curvatura" value={stand.curve} options={CURVE_OPTIONS}
          onChange={(v) => actions.updateStand(stand.id, { curve: v })}
        />
      )}

      <ColorField label="Color" value={stand.color} onChange={(v) => actions.updateStand(stand.id, { color: v })} />

      <details className="sub" open>
        <summary>Fachada</summary>
        <Select<FacadeKind>
          label="Tipo" value={f.kind} options={FACADE_OPTIONS}
          onChange={(v) => setFacade({ kind: v })}
        />
        {f.kind !== 'none' && (
          <>
            <Slider
              label="Grosor" unit="m" value={f.depth}
              min={0.5} max={40} step={0.5} onChange={(v) => setFacade({ depth: v })}
            />
            {f.kind === 'pillars' && (
              <Slider
                label="Posición de pilares" unit="m" value={f.pillarOffset ?? 0.7}
                min={-3} max={3} step={0.1} onChange={(v) => setFacade({ pillarOffset: v })}
              />
            )}
            {panels && (
              <Slider
                label="Divisiones" unit="" value={f.count} min={2} max={30} step={1}
                onChange={(v) => setFacade({ count: v })}
              />
            )}
            <ColorField label={panels ? 'Color 1' : 'Color'} value={f.color} onChange={(v) => setFacade({ color: v })} />
            {panels && (
              <ColorField label="Color 2" value={f.colorB} onChange={(v) => setFacade({ colorB: v })} />
            )}
          </>
        )}
        <ApplyRow
          allLabel="Fachada a todos los módulos"
          onAll={() => actions.applyStandPatch(stand.id, { facade: f }, 'all')}
        />
      </details>

      <details className="sub">
        <summary>Pilares y barandilla</summary>
        <Select
          label="Pilares" value={stand.columns} options={COLUMN_OPTIONS}
          onChange={(v) => actions.updateStand(stand.id, { columns: v })}
        />
        <Toggle
          label="Barandilla"
          checked={stand.railing}
          onChange={(v) => actions.updateStand(stand.id, { railing: v })}
        />
        <ApplyRow
          moduleLabel="Al módulo"
          onModule={() => actions.applyStandPatch(stand.id, { columns: stand.columns, railing: stand.railing }, 'module')}
          allLabel="A todos"
          onAll={() => actions.applyStandPatch(stand.id, { columns: stand.columns, railing: stand.railing }, 'all')}
        />
      </details>

      <div className="actions">
        <button className="btn" onClick={() => actions.duplicateStand(stand.id)}>Duplicar</button>
        <button className="btn danger" onClick={() => actions.removeStand(stand.id)}>Eliminar</button>
      </div>

      <div className="copy-row">
        <Dropdown<ModuleId | ''>
          ariaLabel="Copiar a módulo"
          value={target}
          options={[
            { value: '', label: 'Copiar a…' },
            ...MODULE_IDS.filter((id) => id !== stand.moduleId).map((id) => ({ value: id, label: MODULE_NAMES[id] })),
          ]}
          onChange={(v) => setTarget(v)}
        />
        <button
          className="btn"
          disabled={!target}
          onClick={() => {
            if (target) actions.copyStandTo(stand.id, target);
          }}
        >
          Copiar
        </button>
      </div>

      <button className="btn full" onClick={() => actions.copyStandToAll(stand.id)}>
        Copiar a todos
      </button>
    </section>
  );
}
