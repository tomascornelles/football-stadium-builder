import { useState } from 'react';
import { PALETTE_COLORS } from '../palette';

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
}

/** Selector de color: muestra el color elegido; al pulsarlo se despliega la paleta y el color personalizado. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const current = value.toLowerCase();
  return (
    <div className="color-picker">
      <button
        type="button"
        className="swatch-btn active swatch-current"
        style={{ background: value }}
        aria-label={`Color ${value}. Pulsa para cambiar`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="swatches">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch-btn ${current === c.toLowerCase() ? 'active' : ''}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
          <input
            type="color"
            className="custom-color"
            value={value}
            aria-label="Color personalizado"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
