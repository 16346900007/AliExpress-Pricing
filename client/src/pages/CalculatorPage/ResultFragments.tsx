import type { ReactNode } from 'react';
import type { FreightQuote, ShippingTemplateGroup } from '@shared/api.interface';
import { ResultStat } from '@/components/carbon-field';
import { fmtPct, fmtRmb } from '@/utils/format';

/** Carbon 结果卡片外框：白底 + 边框，无阴影 */
export function ResultCard({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card shadow-xs">
      {children}
    </div>
  );
}

interface FreightDetailProps {
  freight: FreightQuote | null;
  freightRmb: number;
}

/** 运费明细：运费 ¥、计费重量、重量档位、原币种运费 */
export function FreightDetail({ freight, freightRmb }: FreightDetailProps) {
  const textClass = 'text-base font-normal';
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 border-t border-border p-6 md:grid-cols-4">
      <ResultStat label="运费（¥）" value={fmtRmb(freightRmb)} />
      <ResultStat
        label="计费重量（g）"
        value={freight ? String(freight.billableWeightG) : '—'}
        valueClass={textClass}
      />
      {freight && freight.volumetricWeightG > 0 && (
        <ResultStat
          label="体积重（g）"
          value={String(freight.volumetricWeightG)}
          valueClass={textClass}
        />
      )}
      <ResultStat
        label="重量档位"
        value={freight ? freight.tierLabel : '—'}
        valueClass={textClass}
      />
      <ResultStat
        label="原币种运费"
        value={freight ? `${freight.freightOriginal} ${freight.currency}` : '—'}
        valueClass={textClass}
      />
    </div>
  );
}

interface BuyerFreightRowProps {
  freightRmb: number;
  /** 模板模式下当前生效的分组；手动模式传 null 不渲染 */
  group: ShippingTemplateGroup | null;
}

/** 模板模式：按组计费方式换算的买家实付运费行（free=免邮 / discount=减免 / standard=标准） */
export function BuyerFreightRow({ freightRmb, group }: BuyerFreightRowProps) {
  if (!group) return null;
  let text = `¥${freightRmb.toFixed(2)}`;
  if (group.chargeMode === 'free') {
    text = '¥0.00（免邮）';
  } else if (group.chargeMode === 'discount') {
    const d = group.discountPercent ?? 0;
    text = `¥${(freightRmb * (1 - d)).toFixed(2)}（已减${Math.round(d * 100)}%）`;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-border px-6 py-3 text-xs">
      <span className="text-muted-foreground">买家实付运费</span>
      <span className="font-semibold text-foreground">{text}</span>
    </div>
  );
}

interface UsedParamsProps {
  commissionRate: number;
  lossRate: number;
  exchangeRate: number;
  profitRate?: number;
  minProfitRate?: number;
}

/** 本次计算所用参数脚注条 */
export function UsedParams({
  commissionRate,
  lossRate,
  exchangeRate,
  profitRate,
  minProfitRate,
}: UsedParamsProps) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-border px-6 py-3 text-xs text-muted-foreground">
      <span>佣金率 {fmtPct(commissionRate)}</span>
      <span>损耗率 {fmtPct(lossRate)}</span>
      <span>汇率 1 USD = {exchangeRate} RMB</span>
      {profitRate !== undefined && <span>目标利润率 {fmtPct(profitRate)}</span>}
      {minProfitRate !== undefined && (
        <span>打折后最低利润率 {fmtPct(minProfitRate)}</span>
      )}
    </div>
  );
}
