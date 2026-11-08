import { actions } from '../store';
import {
  FLOOD_OPTIONS,
  ModuleExterior,
  ModuleId,
  Option,
  ROOF_OPTIONS,
  SCORE_OPTIONS,
  WALL_OPTIONS,
} from '../types';
import { Slider } from './Slider';
import { Toggle } from './Toggle';

function Select<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field-row inline">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field-row inline">
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function ExteriorEditor({ moduleId, ext }: { moduleId: ModuleId; ext: ModuleExterior }) {
  const set = (patch: Partial<ModuleExterior>) => actions.setExterior(moduleId, patch);

  return (
    <section className="editor">
      <h2 className="section-title">Exteriores y detalles</h2>

      <details className="sub" open>
        <summary>Fachada</summary>
        <Select label="Estilo" value={ext.wall} options={WALL_OPTIONS} onChange={(v) => set({ wall: v })} />
        {ext.wall !== 'none' && (
          <>
            <Slider label="Altura" unit="m" value={ext.wallHeight} min={4} max={40} step={1}
              onChange={(v) => set({ wallHeight: v })} />
            <Slider label="Distancia a gradas" unit="m" value={ext.wallDistance} min={0} max={30} step={0.5}
              onChange={(v) => set({ wallDistance: v })} />
            <Slider label="Grosor" unit="m" value={ext.wallThickness} min={0.5} max={4} step={0.5}
              onChange={(v) => set({ wallThickness: v })} />
            <ColorField label="Color" value={ext.wallColor} onChange={(v) => set({ wallColor: v })} />
          </>
        )}
      </details>

      <details className="sub">
        <summary>Cubierta</summary>
        <Select label="Tipo" value={ext.roof} options={ROOF_OPTIONS} onChange={(v) => set({ roof: v })} />
        {ext.roof !== 'none' && (
          <>
            <Slider label="Altura sobre gradas" unit="m" value={ext.roofHeight} min={1} max={20} step={0.5}
              onChange={(v) => set({ roofHeight: v })} />
            <Slider label="Vuelo" unit="m" value={ext.roofOverhang} min={0} max={12} step={1}
              onChange={(v) => set({ roofOverhang: v })} />
            <Slider label="Grosor" unit="m" value={ext.roofThickness} min={0.5} max={3} step={0.5}
              onChange={(v) => set({ roofThickness: v })} />
            {ext.roof !== 'canopy' && (
              <Slider label="Inclinación" unit="°" value={ext.roofSlope} min={0} max={25} step={1}
                onChange={(v) => set({ roofSlope: v })} />
            )}
            <Toggle label="Pilares de apoyo" checked={ext.roofColumns} onChange={(v) => set({ roofColumns: v })} />
            <ColorField label="Color" value={ext.roofColor} onChange={(v) => set({ roofColor: v })} />
          </>
        )}
      </details>

      <details className="sub">
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
      </details>

      <details className="sub">
        <summary>Marcador</summary>
        <Select label="Tipo" value={ext.score} options={SCORE_OPTIONS} onChange={(v) => set({ score: v })} />
        {ext.score !== 'none' && (
          <>
            <Slider label="Altura del poste" unit="m" value={ext.scoreHeight} min={4} max={40} step={1}
              onChange={(v) => set({ scoreHeight: v })} />
            <Slider label="Ancho del panel" unit="m" value={ext.scoreWidth} min={2} max={20} step={1}
              onChange={(v) => set({ scoreWidth: v })} />
          </>
        )}
      </details>

      <button className="btn full" onClick={() => actions.applyExteriorToAll(moduleId)}>
        Aplicar exteriores a todos los módulos
      </button>
    </section>
  );
}
