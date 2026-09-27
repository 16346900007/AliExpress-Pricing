import { useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { PriceCalcResult, ShippingTemplateGroup } from '@shared/api.interface';
import { calcPrice } from '@/api/pricing';
import { ResultStat } from '@/components/carbon-field';
import { Button } from '@/components/ui/button';
import { fmtRmb, fmtUsd, getErrorMessage } from '@/utils/format';
import { parseCommonValues, type CommonValues } from './FreightInputs';
import { BuyerFreightRow, FreightDetail, ResultCard, UsedParams } from './ResultFragments';

interface BreakevenPanelProps {
  values: CommonValues;
  templateGroup?: ShippingTemplateGroup | null;
}

/** 保本价：利润为 0 的最低售价 */
const BreakevenPanel = ({ values, templateGroup = null }: BreakevenPanelProps) => {
  const [result, setResult] = useState<PriceCalcResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async (): Promise<void> => {
    setResult(null);
    try {
      const base = parseCommonValues(values);
      setLoading(true);
      const res = await calcPrice(base);
      setResult(res);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResult(null);
      logger.error('保本价计算失败', error);
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
        {loading ? '计算中…' : '计算保本价'}
      </Button>
      {result && (
        <ResultCard>
          <div className="border-b border-border p-6">
            <p className="text-xs text-muted-foreground">保本价（USD）</p>
            <p className="text-[28px] font-semibold leading-[1.1] text-foreground">{fmtUsd(result.breakEvenPriceUsd)}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 p-6 md:grid-cols-4">
            <ResultStat label="运费（¥）" value={fmtRmb(result.freightRmb)} />
            <ResultStat label="成本合计（¥）" value={fmtRmb(result.totalCostRmb)} />
            <ResultStat label="建议售价（USD）" value={fmtUsd(result.suggestedPriceUsd)} />
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

export default BreakevenPanel;
