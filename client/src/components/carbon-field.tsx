import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 暖纸看板风格输入框通用类：
 * 白底 + 边框强 1px 描边 + 8px 圆角。
 */
export const carbonInputClass =
  'h-10 rounded-md border border-input bg-card px-3 text-sm';

/** 暖纸看板风格下拉触发器通用类（同输入框） */
export const carbonSelectTriggerClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm data-[size=default]:h-10';

interface CarbonFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** label 常显在控件上方的 Carbon 表单字段容器 */
export function CarbonField({ label, children, className }: CarbonFieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

interface ResultStatProps {
  label: string;
  value: string;
  valueClass?: string;
}

/** 结果卡片内单个数字指标 */
export function ResultStat({ label, value, valueClass }: ResultStatProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('truncate text-[28px] font-semibold leading-[1.1]', valueClass)}>{value}</p>
    </div>
  );
}
