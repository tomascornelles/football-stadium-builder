import { PALETTE_COLORS } from '../palette';

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
}

/** Selector de color: 12 colores predefinidos y un color personalizado. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const current = value.toLowerCase();
  return (
    <div className="color-picker">
      <div className="swatches">
        {PALETTE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch-btn ${current === c.toLowerCase() ? 'active' : ''}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <input
        type="color"
        className="custom-color"
        value={value}
        aria-label="Color personalizado"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
