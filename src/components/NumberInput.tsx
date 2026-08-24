import type { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
};

/** Drop a leading 0 so typing 300 in a 0 field becomes 300, not 0300. Keep 0.5. */
export function stripLeadingZeros(raw: string): string {
  if (raw === '' || raw === '-' || raw === '.') return raw;
  if (raw.startsWith('0.') || raw.startsWith('-0.')) return raw;
  return raw.replace(/^(-?)0+(?=\d)/, '$1');
}

export function parseNumberInput(raw: string): number {
  if (raw === '' || raw === '-' || raw === '.') return 0;
  const n = Number(stripLeadingZeros(raw));
  return Number.isFinite(n) ? n : 0;
}

export function NumberInput({ value, onChange, placeholder = '0', onFocus, ...rest }: Props) {
  const n = Number(value);
  const empty = value === '' || value == null || !Number.isFinite(n) || n === 0;

  return (
    <input
      {...rest}
      type="number"
      placeholder={placeholder}
      value={empty ? '' : value}
      onFocus={(e) => {
        e.target.select();
        onFocus?.(e);
      }}
      onChange={(e) => onChange(parseNumberInput(e.target.value))}
    />
  );
}
