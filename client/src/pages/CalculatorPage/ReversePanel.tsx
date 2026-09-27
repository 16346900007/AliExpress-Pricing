import { useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ReverseCalcResult, ShippingTemplateGroup } from '@shared/api.interface';
import { calcReverse } from '@/api/pricing';
import {
  CarbonField,
  ResultStat,
  carbonInputClass,
} from '@/components/carbon-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fmtPct,
  fmtRmb,
  fmtUsd,
  getErrorMessage,
  parsePositiveNumber,
} from '@/utils/format';
import { parseCommonValues, type CommonValues } from './FreightInputs';
import { BuyerFreightRow, FreightDetail, ResultCard, UsedParams } from './ResultFragments';

interface ReversePanelProps {
  values: CommonValues;
  templateGroup?: ShippingTemplateGroup | null;
}

/** 反向验算：实际售价 → 真实利润 / 实际利润率 */
const ReversePanel = ({ values, templateGroup = null }: ReversePanelProps) => {
  const [sellingPrice, setSellingPrice] = useState('');
  const [result, setResult] = useState<ReverseCalcResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async (): Promise<void> => {
    setResult(null);
    try {
      const base = parseCommonValues(values);
      const sellingPriceUsd = parsePositiveNumber(sellingPrice, '实际售价');
      setLoading(true);
      const res = await calcReverse({ ...base, sellingPriceUsd });
      setResult(res);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResult(null);
      logger.error('反向验算失败', error);
    } finally {
      setLoading(false);
    }
  };

  const profitNegative = result !== null && result.profitRmb < 0;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <CarbonField label="实际售价（USD）" className="w-56">
          <Input
            className={carbonInputClass}
            inputMode="decimal"
            placeholder="如 12.99"
            value={sellingPrice}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSellingPrice(e.target.value)}
          />
        </CarbonField>
        <Button
          onClick={() => void handleCalculate()}
          disabled={loading}
          className="pr-10 text-left"
        >
          {loading ? '验算中…' : '验算真实利润'}
        </Button>
      </div>
      {result && (
        <ResultCard>
          <div className="border-b border-border p-6">
            <p className="text-xs text-muted-foreground">真实利润（¥）</p>
            <p
              className={`text-[28px] font-semibold leading-[1.1] text-foreground${profitNegative ? ' text-destructive' : ''}`}
            >
              {fmtRmb(result.profitRmb)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 p-6 md:grid-cols-4">
            <ResultStat
              label="实际利润率"
              value={fmtPct(result.profitMargin)}
              valueClass={profitNegative ? 'text-destructive' : undefined}
            />
            <ResultStat label="保本价（USD）" value={fmtUsd(result.breakEvenPriceUsd)} />
            <ResultStat label="净收入（¥）" value={fmtRmb(result.netRevenueRmb)} />
            <ResultStat label="成本合计（¥）" value={fmtRmb(result.totalCostRmb)} />
          </div>
          <FreightDetail freight={result.freight} freightRmb={result.freightRmb} />
          <BuyerFreightRow freightRmb={result.freightRmb} group={templateGroup} />
          <UsedParams
            commissionRate={result.usedCommissionRate}
            lossRate={result.usedLossRate}
            exchangeRate={result.usedExchangeRate}
          />
        </ResultCard>
      )}
    </div>
  );
};

export default ReversePanel;
