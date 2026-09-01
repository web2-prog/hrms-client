import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EMPTY = '__all__';

export type AppSelectOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  className?: string;
  title?: string;
  disabled?: boolean;
};

/** Toolbar/filter select that portals its menu so listing cards cannot clip it. */
export function AppSelect({ value, onChange, options, className, title, disabled }: Props) {
  const current = value || EMPTY;
  return (
    <Select value={current} onValueChange={(v) => onChange(v === EMPTY ? '' : v)} disabled={disabled}>
      <SelectTrigger
        title={title}
        className={cn(
          'select h-11 shadow-none focus-visible:ring-0 focus-visible:outline-none focus-visible:border-[var(--primary)]',
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="app-select-menu">
        {options.map((o) => {
          const itemValue = o.value || EMPTY;
          return (
            <SelectItem key={itemValue} value={itemValue}>
              {o.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
