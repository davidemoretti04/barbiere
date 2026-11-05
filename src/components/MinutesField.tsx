import { useState } from 'react';
import { Field } from './ui';

/** Campo numerico libero in minuti (5–480). */
export function MinutesField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <Field label={label}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '');
          setText(t);
          const n = parseInt(t, 10);
          if (n >= 5 && n <= 480) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
      <span className="suffix">min</span>
    </Field>
  );
}
