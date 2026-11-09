import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PALETTE_COLORS } from '../palette';

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
}

/** Selector de color: botón con el color actual; al pulsarlo aparece una rejilla translúcida de 24 colores. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const current = value.toLowerCase();

  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      const width = Math.max(r.width, 232);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 6, left, width });
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="color-picker">
      <button
        ref={btn}
        type="button"
        className="dropdown-trigger"
        aria-label={`Color ${value}. Pulsa para cambiar`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="color-chip" style={{ background: value }} />
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && createPortal(
        <>
          <div className="dropdown-backdrop" onPointerDown={() => setOpen(false)} />
          <div
            className="color-popup"
            role="listbox"
            aria-label="Colores"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={current === c.toLowerCase()}
                aria-label={c}
                title={c}
                className={`color-swatch ${current === c.toLowerCase() ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
