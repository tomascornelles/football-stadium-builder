import { ColorPicker } from './ColorPicker';
import { Option } from '../types';

export function Select<T extends string>({
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

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field-row inline">
      <span>{label}</span>
      <ColorPicker value={value} onChange={(v) => onChange(v)} />
    </label>
  );
}

/** Botones de alcance: aplicar a los demás elementos del módulo o a todo el estadio. */
export function ApplyRow({
  onModule, onAll, moduleLabel, allLabel,
}: {
  onModule?: () => void;
  onAll: () => void;
  moduleLabel?: string;
  allLabel: string;
}) {
  return (
    <div className="actions apply-row">
      {onModule && <button className="btn" onClick={onModule}>{moduleLabel}</button>}
      <button className="btn" onClick={onAll}>{allLabel}</button>
    </div>
  );
}
