import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { carbonSelectTriggerClass } from '@/components/carbon-field';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** 参与检索的补充关键词（如国家英文 / 代码） */
  keywords?: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** 是否允许输入自定义值（不在选项列表中也可选中） */
  allowCustomValue?: boolean;
}

/** 带输入检索的单选下拉框（Carbon 风格触发器） */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = '请选择',
  searchPlaceholder = '输入关键词检索',
  disabled,
  allowCustomValue = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((o: SearchableSelectOption) => o.value === value);

  const hasExactMatch =
    options.some((o: SearchableSelectOption) => o.value === search) ||
    search.trim() === '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            carbonSelectTriggerClass,
            'flex items-center justify-between gap-2 border border-input outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 rounded-lg border border-border bg-popover p-0 shadow-xs"
        align="start"
      >
        <Command onValueChange={setSearch} value={search}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            {allowCustomValue && !hasExactMatch && (
              <CommandGroup>
                <CommandItem
                  value={`__custom__${search}`}
                  onSelect={() => {
                    onValueChange(search.trim());
                    setOpen(false);
                    setSearch('');
                  }}
                  className="font-semibold"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">使用自定义值：{search}</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandEmpty>未找到匹配项</CommandEmpty>
            <CommandGroup>
              {options.map((o: SearchableSelectOption) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.keywords ?? ''}`}
                  onSelect={() => {
                    onValueChange(o.value);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === o.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span
                    className={cn(
                      'truncate',
                      value === o.value && 'font-semibold'
                    )}
                  >
                    {o.label}
                  </span>
                  {o.keywords && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {o.keywords}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
