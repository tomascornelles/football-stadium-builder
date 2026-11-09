import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Option } from '../types';

/** Desplegable translúcido propio: el popup nativo del sistema no admite transparencia ni buen contraste. */
export function Dropdown<T extends string>({
  value, options, onChange, ariaLabel,
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);

  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: r.width });
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
    <>
      <button
        ref={btn}
        type="button"
        className="dropdown-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="dropdown-value">{current?.label ?? ''}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && createPortal(
        <>
          <div className="dropdown-backdrop" onPointerDown={() => setOpen(false)} />
          <ul
            className="dropdown-list"
            role="listbox"
            aria-label={ariaLabel}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {options.map((o) => (
              <li
                key={o.value || '_empty'}
                role="option"
                aria-selected={o.value === value}
                className={`dropdown-item ${o.value === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </>,
        document.body,
      )}
    </>
  );
}
