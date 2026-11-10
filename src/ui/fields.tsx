import type { ReactNode } from 'react';
import { ColorPicker } from './ColorPicker';
import { Option } from '../types';
import { Dropdown } from './Dropdown';

export function Select<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field-row inline">
      <span>{label}</span>
      <Dropdown value={value} options={options} onChange={onChange} ariaLabel={label} />
    </div>
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

/** Control segmentado tipo día/noche: dos o más opciones visibles a la vez. */
export function Segmented<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field-row inline">
      <span>{label}</span>
      <div className="segmented" role="tablist" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={value === o.value}
            className={value === o.value ? 'active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Barra de opciones con icono, con el mismo aspecto que las herramientas del entorno. */
export function OptionBar<T extends string>({
  label, value, options, icons, onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  icons: Record<T, ReactNode>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="option-field">
      <span className="option-label">{label}</span>
      <div className="tool-bar option-bar" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`tool-bar-btn ${value === o.value ? 'active' : ''}`}
            aria-pressed={value === o.value}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">{icons[o.value]}</svg>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
