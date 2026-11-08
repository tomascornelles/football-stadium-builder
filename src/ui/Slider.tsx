interface SliderProps {
  label: string;
  unit: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

export function Slider({ label, unit, hint, value, min, max, step, onChange }: SliderProps) {
  return (
    <label className="field-row">
      <span className="top">
        <span>
          {label}
          {hint && <small className="muted"> {hint}</small>}
        </span>
        <strong>{value.toFixed(step < 1 ? 1 : 0)} {unit}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
