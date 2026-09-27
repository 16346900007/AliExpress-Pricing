import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Table, TableProps } from '@lark-apaas/client-toolkit/antd-table';
import type {
  CompareLineResult,
  CountryOption,
  GoodsType,
  ShippingLineOption,
} from '@shared/api.interface';
import { compareLines, getCountries } from '@/api/pricing';
import { CarbonField, carbonInputClass } from '@/components/carbon-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/searchable-select';
import {
  fmtRmb,
  fmtUsd,
  getErrorMessage,
  parseNonNegativeNumber,
  parsePercentInput,
  parsePositiveNumber,
} from '@/utils/format';

const GOODS_TYPES: GoodsType[] = ['普货', '非普货', '大包'];

/** "对比全部线路" 的占位值（SelectItem 不允许空 value） */
const ALL_LINES = '__all_lines__';

const columns: TableProps<CompareLineResult>['columns'] = [
  {
    title: '物流线路',
    dataIndex: 'lineName',
    width: 220,
    render: (_v: unknown, r: CompareLineResult) => (
      <span className="flex items-center gap-2">
        {r.lineName}
        {r.recommended && (
          <Badge className="rounded-full bg-[#fff6d6] px-2.5 py-0.5 text-[11px] font-medium text-[#9a7b12]">
            推荐
          </Badge>
        )}
      </span>
    ),
  },
  {
    title: '分类',
    dataIndex: 'lineCategory',
    width: 160,
  },
  {
    title: '运费（¥）',
    dataIndex: 'freightRmb',
    width: 120,
    render: (v: number, r: CompareLineResult) =>
      r.available ? fmtRmb(v) : <span className="text-muted-foreground">未覆盖</span>,
  },
  {
    title: '保本价（$）',
    dataIndex: 'breakEvenPriceUsd',
    width: 120,
    render: (v: number, r: CompareLineResult) => (r.available ? fmtUsd(v) : '—'),
  },
  {
    title: '建议售价（$）',
    dataIndex: 'suggestedPriceUsd',
    width: 140,
    render: (v: number, r: CompareLineResult) =>
      r.available ? (
        <span className="font-semibold text-foreground">{fmtUsd(v)}</span>
      ) : (
        '—'
      ),
  },
  {
    title: '预期利润（¥）',
    dataIndex: 'expectedProfitRmb',
    width: 140,
    render: (v: number, r: CompareLineResult) => (r.available ? fmtRmb(v) : '—'),
  },
];

interface CompareLinesTabProps {
  lines: ShippingLineOption[];
}

/** 多线路比价：同一商品跨线路运费 / 保本价 / 利润对比 */
const CompareLinesTab = ({ lines }: CompareLinesTabProps) => {
  const [allCountries, setAllCountries] = useState<CountryOption[]>([]);
  const [countriesByLine, setCountriesByLine] = useState<Record<string, CountryOption[]>>({});
  const [merging, setMerging] = useState(true);
  const [lineScope, setLineScope] = useState<string>(ALL_LINES);
  const [countryCode, setCountryCode] = useState('');
  const [weightG, setWeightG] = useState('');
  const [productCostRmb, setProductCostRmb] = useState('');
  const [goodsType, setGoodsType] = useState<GoodsType>('普货');
  const [profitRatePct, setProfitRatePct] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [result, setResult] = useState<CompareLineResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  // 合并全部线路的国家作为国家下拉数据源（仅加载一次）
  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    setMerging(true);
    Promise.all(
      lines.map((line: ShippingLineOption) =>
        getCountries(line.lineName).catch(
          (): CountryOption[] => [] as CountryOption[]
        )
      )
    )
      .then((groups: CountryOption[][]) => {
        if (cancelled) return;
        const merged = new Map<string, CountryOption>();
        for (const group of groups) {
          for (const c of group) merged.set(c.countryCode, c);
        }
        setAllCountries([...merged.values()]);
        const byLine: Record<string, CountryOption[]> = {};
        lines.forEach((line: ShippingLineOption, i: number) => {
          byLine[line.lineName] = groups[i];
        });
        setCountriesByLine(byLine);
      })
      .catch((error: unknown) => {
        logger.error('合并国家列表失败', error);
      })
      .finally(() => {
        if (!cancelled) setMerging(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lines]);

  // 指定线路时，国家下拉只展示该线路覆盖的国家
  const countryOptions = useMemo<CountryOption[]>(
    () =>
      lineScope === ALL_LINES ? allCountries : countriesByLine[lineScope] ?? [],
    [allCountries, countriesByLine, lineScope]
  );

  const handleCalculate = async (): Promise<void> => {
    setResult(null);
    try {
      if (!countryCode) throw new Error('请选择目的国家');
      const weight = parsePositiveNumber(weightG, '包裹重量');
      const cost = parseNonNegativeNumber(productCostRmb, '采购成本');
      const profitRate =
        profitRatePct === '' ? undefined : parsePercentInput(profitRatePct, '目标利润率');
      const lineNames = lineScope === ALL_LINES ? undefined : [lineScope];
      if (lineNames && countryCode && !countriesByLine[lineScope]?.some(
        (c: CountryOption) => c.countryCode === countryCode
      )) {
        throw new Error('所选国家不在该线路上，请重新选择国家');
      }
      const dimsProvided = lengthCm !== '' || widthCm !== '' || heightCm !== '';
      if (dimsProvided && (lengthCm === '' || widthCm === '' || heightCm === '')) {
        throw new Error('启用体积重需完整填写长 / 宽 / 高');
      }
      setLoading(true);
      const res = await compareLines({
        countryCode,
        weightG: weight,
        productCostRmb: cost,
        goodsType,
        profitRate,
        lineNames,
        lengthCm: lengthCm === '' ? undefined : parsePositiveNumber(lengthCm, '长度'),
        widthCm: widthCm === '' ? undefined : parsePositiveNumber(widthCm, '宽度'),
        heightCm: heightCm === '' ? undefined : parsePositiveNumber(heightCm, '高度'),
      });
      setResult(res);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResult(null);
      logger.error('多线路比价失败', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <CarbonField label="目的国家">
            <SearchableSelect
              value={countryCode}
              onValueChange={(v: string) => setCountryCode(v)}
              disabled={merging}
              options={countryOptions.map((c: CountryOption) => ({
                value: c.countryCode,
                label: c.countryZh,
                keywords: `${c.countryEn} ${c.countryCode}`,
              }))}
              placeholder={merging ? '加载中…' : '请选择国家'}
              searchPlaceholder="输入国家中文名 / 英文名 / 代码检索"
            />
          </CarbonField>
          <CarbonField label="对比线路（可不选）">
            <SearchableSelect
              value={lineScope}
              onValueChange={(v: string) => setLineScope(v)}
              options={[
                { value: ALL_LINES, label: '对比全部线路' },
                ...lines.map((line: ShippingLineOption) => ({
                  value: line.lineName,
                  label: line.lineName,
                  keywords: line.lineCategory,
                })),
              ]}
              searchPlaceholder="输入线路 / 分类检索"
            />
          </CarbonField>
          <CarbonField label="包裹重量（g）">
            <Input
              className={carbonInputClass}
              inputMode="decimal"
              placeholder="如 500"
              value={weightG}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWeightG(e.target.value)}
            />
          </CarbonField>
          <CarbonField label="采购成本（¥）">
            <Input
              className={carbonInputClass}
              inputMode="decimal"
              placeholder="如 25"
              value={productCostRmb}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setProductCostRmb(e.target.value)
              }
            />
          </CarbonField>
          <CarbonField label="货型">
            <SearchableSelect
              value={goodsType}
              onValueChange={(v: string) => setGoodsType(v as GoodsType)}
              options={GOODS_TYPES.map((t: GoodsType) => ({ value: t, label: t }))}
              placeholder="请选择货型"
            />
          </CarbonField>
          <CarbonField label="目标利润率（%，可空）">
            <Input
              className={carbonInputClass}
              inputMode="decimal"
              placeholder="如 30"
              value={profitRatePct}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setProfitRatePct(e.target.value)
              }
            />
          </CarbonField>
          <CarbonField label="长（cm，选填）">
            <Input
              className={carbonInputClass}
              inputMode="decimal"
              placeholder="启用体积重"
              value={lengthCm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLengthCm(e.target.value)
              }
            />
          </CarbonField>
          <CarbonField label="宽（cm，选填）">
            <Input
              className={carbonInputClass}
              inputMode="decimal"
              placeholder="启用体积重"
              value={widthCm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setWidthCm(e.target.value)
              }
            />
          </CarbonField>
          <CarbonField label="高（cm，选填）">
            <Input
              className={carbonInputClass}
              inputMode="decimal"
              placeholder="启用体积重"
              value={heightCm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setHeightCm(e.target.value)
              }
            />
          </CarbonField>
        </div>
        <div className="mt-6">
          <Button
            onClick={() => void handleCalculate()}
            disabled={loading}
            className="pr-10 text-left"
          >
            {loading ? '比价中…' : '对比线路运费与利润'}
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <Table
            columns={columns}
            dataSource={result}
            rowKey="lineName"
            loading={loading}
            scroll={{ x: 1100, y: 500 }}
            pagination={false}
            rowClassName={(r: CompareLineResult) => (r.available ? '' : 'opacity-50')}
          />
        </div>
      )}
    </div>
  );
};

export default CompareLinesTab;
