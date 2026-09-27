import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CountryOption } from '@shared/api.interface';
import { cn } from '@/lib/utils';
import { carbonSelectTriggerClass } from '@/components/carbon-field';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface CountryMultiSelectProps {
  options: CountryOption[];
  selected: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

/** 带搜索框的国家多选器（Carbon 风格触发器） */
export default function CountryMultiSelect({
  options,
  selected,
  onChange,
  disabled,
}: CountryMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (code: string): void => {
    onChange(
      selected.includes(code)
        ? selected.filter((c: string) => c !== code)
        : [...selected, code]
    );
  };

  const triggerLabel =
    selected.length === 0
      ? '搜索并选择国家'
      : `已选 ${selected.length} 个国家`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center justify-between border outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
            carbonSelectTriggerClass,
            selected.length === 0 && 'text-muted-foreground'
          )}
        >
          {triggerLabel}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索国家（中文名 / 代码）" />
          <CommandList>
            <CommandEmpty>未找到匹配的国家</CommandEmpty>
            <CommandGroup>
              {options.map((c: CountryOption) => (
                <CommandItem
                  key={c.countryCode}
                  value={`${c.countryZh} ${c.countryEn} ${c.countryCode}`}
                  onSelect={() => toggle(c.countryCode)}
                >
                  <Checkbox
                    checked={selected.includes(c.countryCode)}
                    className="pointer-events-none"
                  />
                  <span>{c.countryZh}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {c.countryCode}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
