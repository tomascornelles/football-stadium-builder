import { ColorPicker } from './ColorPicker';
import { useState } from 'react';
import { actions, getState } from '../store';
import { CORNER_TEMPLATE_LABEL, computeAnchors, cornerTemplateOf } from '../geometry/modules';
import { LIMITS } from '../config';
import { CURVE_OPTIONS, CurveType, MODULE_IDS, MODULE_NAMES, ModuleId, Stand } from '../types';
import { Slider } from './Slider';
import { Toggle } from './Toggle';

const CORNER_IDS: ModuleId[] = ['nw', 'ne', 'sw', 'se'];

export function StandEditor({ stand }: { stand: Stand }) {
  const [target, setTarget] = useState<ModuleId | ''>('');
  const corner = CORNER_IDS.includes(stand.moduleId);

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
      {corner ? (
        <p className="hint-text">
          Esquina con plantilla {CORNER_TEMPLATE_LABEL[cornerTemplateOf(stand.moduleId, computeAnchors(getState().stands))]}:
          se ajusta a las gradas vecinas.
        </p>
      ) : (
        <label className="field-row inline">
          <span>Curvatura</span>
          <select
            value={stand.curve}
            onChange={(e) => actions.updateStand(stand.id, { curve: e.target.value as CurveType })}
          >
            {CURVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      )}

      <label className="field-row inline">
        <span>Color</span>
        <ColorPicker
          
          value={stand.color}
          onChange={(v) => actions.updateStand(stand.id, { color: v })}
        />
      </label>

      <Toggle
        label="Pilares"
        checked={stand.columns}
        onChange={(v) => actions.updateStand(stand.id, { columns: v })}
      />
      <Toggle
        label="Barandilla"
        checked={stand.railing}
        onChange={(v) => actions.updateStand(stand.id, { railing: v })}
      />

      <div className="actions">
        <button className="btn" onClick={() => actions.duplicateStand(stand.id)}>Duplicar</button>
        <button className="btn danger" onClick={() => actions.removeStand(stand.id)}>Eliminar</button>
      </div>

      <div className="copy-row">
        <select value={target} onChange={(e) => setTarget(e.target.value as ModuleId | '')}>
          <option value="">Copiar a módulo…</option>
          {MODULE_IDS.filter((id) => id !== stand.moduleId).map((id) => (
            <option key={id} value={id}>{MODULE_NAMES[id]}</option>
          ))}
        </select>
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
        Copiar a todos los módulos
      </button>
    </section>
  );
}
