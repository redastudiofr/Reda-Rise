'use client';

import { useState } from 'react';
import { LIMITS } from '@/lib/network/validate';

/** Free tags (skills, interests): Enter or comma adds one. */
export default function TagInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  function add(text = draft) {
    const t = text.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIMITS.tag);
    if (t && value.length < LIMITS.tags && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft('');
  }
  return (
    <div className="field">
      <span>
        {label} <small className="mono">{value.length}/{LIMITS.tags}</small>
      </span>
      {value.length > 0 ? (
        <div className="chip-grid" style={{ marginBottom: 8 }}>
          {value.map((t) => (
            <button key={t} type="button" className="chip net-chip-x" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Retirer ${t}`}>
              {t} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}
      {value.length < LIMITS.tags ? (
        <input
          className="input"
          value={draft}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => (e.target.value.includes(',') ? add(e.target.value.split(',')[0]) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={() => add()}
        />
      ) : null}
    </div>
  );
}
