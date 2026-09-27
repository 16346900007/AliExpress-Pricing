import { useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { PriceCalcResult, ShippingTemplateGroup } from '@shared/api.interface';
import { calcPrice } from '@/api/pricing';
import { ResultStat } from '@/components/carbon-field';
import { Button } from '@/components/ui/button';
import { fmtRmb, fmtUsd, getErrorMessage, parsePercentInput } from '@/utils/format';
import { parseCommonValues, type CommonValues } from './FreightInputs';
import { BuyerFreightRow, FreightDetail, ResultCard, UsedParams } from './ResultFragments';

interface ForwardPanelProps {
  values: CommonValues;
  templateGroup?: ShippingTemplateGroup | null;
}

/** 正向定价：目标利润率 → 建议售价 */
const ForwardPanel = ({ values, templateGroup = null }: ForwardPanelProps) => {
  const [result, setResult] = useState<PriceCalcResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async (): Promise<void> => {
    setResult(null);
    let profitRate: number;
    try {
      const base = parseCommonValues(values);
      profitRate = parsePercentInput(values.profitRatePct, '目标利润率');
      setLoading(true);
      const res = await calcPrice({ ...base, profitRate });
      setResult(res);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResult(null);
      logger.error('正向定价计算失败', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={() => void handleCalculate()}
        disabled={loading}
        className="pr-10 text-left"
      >
        {loading ? '计算中…' : '计算建议售价'}
      </Button>
      {result && (
        <ResultCard>
          <div className="border-b border-border p-6">
            <p className="text-xs text-muted-foreground">建议售价（USD）</p>
            <p className="text-[28px] font-semibold leading-[1.1] text-foreground">{fmtUsd(result.suggestedPriceUsd)}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 p-6 md:grid-cols-4">
            <ResultStat label="保本价（USD）" value={fmtUsd(result.breakEvenPriceUsd)} />
            <ResultStat label="预期利润（¥）" value={fmtRmb(result.expectedProfitRmb)} />
            <ResultStat label="成本合计（¥）" value={fmtRmb(result.totalCostRmb)} />
          </div>
          <FreightDetail freight={result.freight} freightRmb={result.freightRmb} />
          <BuyerFreightRow freightRmb={result.freightRmb} group={templateGroup} />
          <UsedParams
            commissionRate={result.usedCommissionRate}
            lossRate={result.usedLossRate}
            exchangeRate={result.usedExchangeRate}
            profitRate={result.usedProfitRate}
          />
        </ResultCard>
      )}
    </div>
  );
};

export default ForwardPanel;
