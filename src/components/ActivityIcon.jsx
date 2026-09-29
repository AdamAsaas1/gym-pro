import { createElement, useEffect, useRef, useState } from 'react';
import {
  Dumbbell, HandFist, Flower2, Bike, Waves, Footprints,
  HeartPulse, Volleyball, Target, Medal, CupSoda, ChevronDown, Check,
} from 'lucide-react';

// Tied martial-arts belt, drawn in the same 24x24 line style as lucide (no such icon exists there).
function KarateBelt({ size = 24, strokeWidth = 2, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      {...rest}
    >
      <path d="M2 8.5h7M15 8.5h7M2 12h7M15 12h7" />
      <path d="M9.5 6.5 14.5 14M14.5 6.5 9.5 14" />
      <path d="m9.5 14-3 7M14.5 14l3 7" />
    </svg>
  );
}

// Activities store an emoji in the database; we render a matching line icon instead.
const EMOJI_TO_ICON = {
  '\u{1F3CB}': Dumbbell,   // weight lifter
  '\u{1F94B}': KarateBelt, // martial arts uniform
  '\u{1F94A}': HandFist,   // boxing glove
  '\u{1F9D8}': Flower2,    // yoga
  '\u{1F6B4}': Bike,       // cycling
  '\u{1F3CA}': Waves,      // swimming
  '\u{1F3C3}': Footprints, // running
  '\u{1F483}': HeartPulse, // dancing / aerobic
  '⚽': Volleyball,    // soccer ball
  '\u{1F3BE}': Target,     // tennis
  '\u{1F947}': Medal,      // gold medal
  '\u{1F964}': CupSoda,    // drink
};

function getActivityIcon(emoji) {
  // Strip the emoji variation selector (U+FE0F) so "🏋️" and "🏋" match the same key.
  const key = (emoji || '').replace(/️/g, '').trim();
  return EMOJI_TO_ICON[key] || Dumbbell;
}

// Line icon, optionally on a tinted badge. `color` defaults to the current text color.
export default function ActivityIcon({ icon, color, size = 16, badge = false, className = '' }) {
  const Icon = getActivityIcon(icon);
  if (!badge) {
    return createElement(Icon, {
      size, strokeWidth: 2, className: `activity-icon-svg ${className}`, style: color ? { color } : undefined, 'aria-hidden': true,
    });
  }
  return (
    <span className={`activity-badge ${className}`} style={color ? { '--act-clr': color } : undefined} aria-hidden="true">
      {createElement(Icon, { size, strokeWidth: 2 })}
    </span>
  );
}

// Styled dropdown that shows each activity with its icon (replaces a native <select>).
export function ActivitySelect({ value, options, onChange, emptyLabel, getLabel = (a) => a.nom }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = options.find((a) => a.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="act-select" ref={rootRef}>
      <button
        type="button"
        className={`act-select__trigger${open ? ' is-open' : ''}`}
        onClick={() => options.length && setOpen(!open)}
        disabled={!options.length}
      >
        {current ? (
          <span className="act-select__value">
            <ActivityIcon icon={current.icon} color={current.couleur} badge size={14} />
            {getLabel(current)}
          </span>
        ) : (
          <span className="act-select__placeholder">{emptyLabel}</span>
        )}
        <ChevronDown size={16} className="act-select__chevron" />
      </button>
      {open && (
        <ul className="act-select__menu" role="listbox">
          {options.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                role="option"
                aria-selected={a.id === value}
                className={`act-select__option${a.id === value ? ' is-selected' : ''}`}
                onClick={() => { onChange(a.id); setOpen(false); }}
              >
                <ActivityIcon icon={a.icon} color={a.couleur} badge size={14} />
                <span>{getLabel(a)}</span>
                {a.id === value && <Check size={15} className="act-select__check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
