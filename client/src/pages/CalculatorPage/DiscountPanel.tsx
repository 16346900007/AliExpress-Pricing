import { useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { DiscountCalcResult, ShippingTemplateGroup } from '@shared/api.interface';
import { calcDiscount } from '@/api/pricing';
import {
  CarbonField,
  ResultStat,
  carbonInputClass,
} from '@/components/carbon-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fmtUsd, getErrorMessage, parsePercentInput, parsePositiveNumber } from '@/utils/format';
import { parseCommonValues, type CommonValues } from './FreightInputs';
import { BuyerFreightRow, ResultCard, UsedParams } from './ResultFragments';

interface DiscountPanelProps {
  values: CommonValues;
  templateGroup?: ShippingTemplateGroup | null;
}

/** 折扣藏价：划线价 + 最低利润率 → 最大可降价幅度 */
const DiscountPanel = ({ values, templateGroup = null }: DiscountPanelProps) => {
  const [listPrice, setListPrice] = useState('');
  const [minProfitRatePct, setMinProfitRatePct] = useState('0');
  const [result, setResult] = useState<DiscountCalcResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async (): Promise<void> => {
    setResult(null);
    try {
      const base = parseCommonValues(values);
      const listPriceUsd = parsePositiveNumber(listPrice, '划线价');
      const minProfitRate = parsePercentInput(minProfitRatePct, '打折后最低利润率');
      setLoading(true);
      const res = await calcDiscount({ ...base, listPriceUsd, minProfitRate });
      setResult(res);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResult(null);
      logger.error('折扣藏价计算失败', error);
    } finally {
      setLoading(false);
    }
  };

  const overpriced = result !== null && result.maxDiscountRate < 0;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <CarbonField label="划线价（USD）" className="w-56">
          <Input
            className={carbonInputClass}
            inputMode="decimal"
            placeholder="如 19.99"
            value={listPrice}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setListPrice(e.target.value)}
          />
        </CarbonField>
        <CarbonField label="打折后最低利润率（%）" className="w-56">
          <Input
            className={carbonInputClass}
            inputMode="decimal"
            placeholder="0"
            value={minProfitRatePct}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setMinProfitRatePct(e.target.value)
            }
          />
        </CarbonField>
        <Button
          onClick={() => void handleCalculate()}
          disabled={loading}
          className="pr-10 text-left"
        >
          {loading ? '计算中…' : '计算折扣上限'}
        </Button>
      </div>
      {result && (
        <ResultCard>
          <div className="border-b border-border p-6">
            <p className="text-xs text-muted-foreground">最大可降价比例</p>
            <p
              className={`text-[28px] font-semibold leading-[1.1] text-foreground${overpriced ? ' text-destructive' : ''}`}
            >
              {`${(result.maxDiscountRate * 100).toFixed(2)}%`}
            </p>
            {overpriced && (
              <p className="mt-1 text-xs text-destructive">
                划线价低于最低要求售价，无法在满足利润率的前提下打折
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 p-6 md:grid-cols-3">
            <ResultStat
              label="折扣下限"
              value={`${(result.minDiscountScale * 10).toFixed(1)} 折`}
            />
            <ResultStat label="折后最低价（USD）" value={fmtUsd(result.minSellPriceUsd)} />
            <ResultStat label="保本价（USD）" value={fmtUsd(result.breakEvenPriceUsd)} />
          </div>
          <BuyerFreightRow freightRmb={result.freightRmb} group={templateGroup} />
          <UsedParams
            commissionRate={result.usedCommissionRate}
            lossRate={result.usedLossRate}
            exchangeRate={result.usedExchangeRate}
            minProfitRate={result.usedMinProfitRate}
          />
        </ResultCard>
      )}
    </div>
  );
};

export default DiscountPanel;
