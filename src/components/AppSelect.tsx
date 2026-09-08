import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EMPTY = '__all__';

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  className?: string;
  title?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  /** Stretch trigger to full width (forms / dialogs). */
  fullWidth?: boolean;
};

/**
 * Select2-style dropdown (Radix Select, portaled menu).
 * Use this for every filter and form dropdown instead of native &lt;select&gt;.
 */
export function AppSelect({
  value,
  onChange,
  options,
  className,
  title,
  disabled,
  placeholder,
  id,
  fullWidth,
}: Props) {
  const current = value || EMPTY;
  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === EMPTY ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        title={title}
        className={cn(
          'select h-11 shadow-none focus-visible:ring-0 focus-visible:outline-none focus-visible:border-[var(--primary)]',
          fullWidth && 'w-full min-w-0',
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="app-select-menu">
        {options.map((o) => {
          const itemValue = o.value || EMPTY;
          return (
            <SelectItem key={itemValue} value={itemValue} disabled={!!o.disabled}>
              {o.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
