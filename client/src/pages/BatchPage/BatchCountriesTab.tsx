import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Table, TableProps } from '@lark-apaas/client-toolkit/antd-table';
import type {
  BatchCountryResult,
  CountryOption,
  GoodsType,
  ShippingLineOption,
  ShippingTemplate,
  ShippingTemplateGroup,
  TemplateChargeMode,
  TemplateCountryRef,
} from '@shared/api.interface';
import { batchCountries, getCountries } from '@/api/pricing';
import { listTemplates } from '@/api/shipping-template';
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
import CountryMultiSelect from './CountryMultiSelect';

const GOODS_TYPES: GoodsType[] = ['普货', '非普货', '大包'];

/** 结果行：模板模式下额外携带所属组线路与买家运费 */
interface BatchRow extends BatchCountryResult {
  templateLineName?: string;
  /** 按组计费方式换算的买家实付运费；未覆盖为 null */
  buyerFreightRmb?: number | null;
  chargeMode?: TemplateChargeMode;
  discountPercent?: number;
}

/** 模板分组去重后的提交单元（同国家多组时首组优先） */
interface DedupedGroup {
  group: ShippingTemplateGroup;
  countryCodes: string[];
}

const countryColumn: TableProps<BatchRow>['columns'] = [
  {
    title: '国家',
    dataIndex: 'countryZh',
    width: 180,
    render: (_v: unknown, r: BatchRow) => (
      <span className="flex items-center gap-2">
        {r.countryZh}
        {!r.available && (
          <Badge className="rounded-full bg-[#fdecec] px-2.5 py-0.5 text-[11px] font-medium text-[#c0392b]">
            线路未覆盖
          </Badge>
        )}
      </span>
    ),
  },
];

const trailingColumns: TableProps<BatchRow>['columns'] = [
  { title: '成本合计（¥）', dataIndex: 'totalCostRmb', width: 140, render: (v: number) => fmtRmb(v) },
  { title: '保本价（$）', dataIndex: 'breakEvenPriceUsd', width: 120, render: (v: number) => fmtUsd(v) },
  {
    title: '建议售价（$）',
    dataIndex: 'suggestedPriceUsd',
    width: 140,
    render: (v: number) => <span className="font-semibold text-foreground">{fmtUsd(v)}</span>,
  },
  {
    title: '划线标价（$）',
    dataIndex: 'listPriceUsd',
    width: 140,
    render: (v: number | undefined) => (v != null ? fmtUsd(v) : '—'),
  },
  { title: '预期利润（¥）', dataIndex: 'expectedProfitRmb', width: 140, render: (v: number) => fmtRmb(v) },
];

const freightColumn: TableProps<BatchRow>['columns'][number] = {
  title: '运费（¥）',
  dataIndex: 'freightRmb',
  width: 120,
  render: (v: number) => fmtRmb(v),
};

const lineColumns: TableProps<BatchRow>['columns'] = [
  ...countryColumn,
  freightColumn,
  ...trailingColumns,
];

const templateColumns: TableProps<BatchRow>['columns'] = [
  ...countryColumn,
  {
    title: '线路',
    dataIndex: 'templateLineName',
    width: 200,
    render: (v: string | undefined) => v ?? '—',
  },
  freightColumn,
  {
    title: '买家运费（¥）',
    dataIndex: 'buyerFreightRmb',
    width: 170,
    render: (v: number | null | undefined, r: BatchRow) => {
      if (v == null || !r.available) return '—';
      if (r.chargeMode === 'free') return '0.00（免邮）';
      if (r.chargeMode === 'discount') {
        return `${v.toFixed(2)}（已减${Math.round((r.discountPercent ?? 0) * 100)}%）`;
      }
      return v.toFixed(2);
    },
  },
  ...trailingColumns,
];

interface BatchCountriesTabProps {
  lines: ShippingLineOption[];
}

/** 多国批量定价：一次录入 → 各目的国建议售价与利润 */
const BatchCountriesTab = ({ lines }: BatchCountriesTabProps) => {
  const [lineName, setLineName] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [weightG, setWeightG] = useState('');
  const [productCostRmb, setProductCostRmb] = useState('');
  const [goodsType, setGoodsType] = useState<GoodsType>('普货');
  const [profitRatePct, setProfitRatePct] = useState('');
  const [discountRatePct, setDiscountRatePct] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [result, setResult] = useState<BatchRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'line' | 'template'>('line');
  const [templates, setTemplates] = useState<ShippingTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');

  // 加载运费模板列表（按模板模式使用）
  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((list: ShippingTemplate[]) => {
        if (!cancelled) setTemplates(list);
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('批量定价加载运费模板失败', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplate = useMemo<ShippingTemplate | null>(
    () => templates.find((t: ShippingTemplate) => t.id === templateId) ?? null,
    [templates, templateId]
  );

  // 同一国家出现在多组时首组优先去重
  const dedupedGroups = useMemo<DedupedGroup[]>(() => {
    if (!selectedTemplate) return [];
    const seen = new Set<string>();
    const out: DedupedGroup[] = [];
    selectedTemplate.groups.forEach((g: ShippingTemplateGroup) => {
      const codes: string[] = [];
      g.countries.forEach((c: TemplateCountryRef) => {
        if (seen.has(c.countryCode)) return;
        seen.add(c.countryCode);
        codes.push(c.countryCode);
      });
      if (codes.length > 0) out.push({ group: g, countryCodes: codes });
    });
    return out;
  }, [selectedTemplate]);

  const coveredCount = useMemo<number>(
    () =>
      dedupedGroups.reduce(
        (sum: number, g: DedupedGroup) => sum + g.countryCodes.length,
        0
      ),
    [dedupedGroups]
  );

  const handleModeChange = (next: 'line' | 'template'): void => {
    setMode(next);
    setResult(null);
  };

  const handleTemplateChange = (v: string): void => {
    setTemplateId(v);
    setResult(null);
  };

  // 线路切换时联动加载国家并清空已选
  useEffect(() => {
    if (!lineName) {
      setCountries([]);
      setSelectedCodes([]);
      return;
    }
    let cancelled = false;
    setCountriesLoading(true);
    setSelectedCodes([]);
    getCountries(lineName)
      .then((list: CountryOption[]) => {
        if (!cancelled) setCountries(list);
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('批量定价加载国家失败', error);
        if (!cancelled) setCountries([]);
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lineName]);

  const handleCalculate = async (): Promise<void> => {
    setResult(null);
    try {
      const weight = parsePositiveNumber(weightG, '包裹重量');
      const cost = parseNonNegativeNumber(productCostRmb, '采购成本');
      const profitRate =
        profitRatePct === '' ? undefined : parsePercentInput(profitRatePct, '目标利润率');
      const discountRate =
        discountRatePct === '' ? undefined : parsePercentInput(discountRatePct, '折扣率');
      if (discountRate != null && discountRate > 0.99) {
        throw new Error('折扣率最大不超过 99%');
      }
      const dimsProvided = lengthCm !== '' || widthCm !== '' || heightCm !== '';
      if (dimsProvided && (lengthCm === '' || widthCm === '' || heightCm === '')) {
        throw new Error('启用体积重需完整填写长 / 宽 / 高');
      }
      const dims = {
        lengthCm: lengthCm === '' ? undefined : parsePositiveNumber(lengthCm, '长度'),
        widthCm: widthCm === '' ? undefined : parsePositiveNumber(widthCm, '宽度'),
        heightCm: heightCm === '' ? undefined : parsePositiveNumber(heightCm, '高度'),
      };
      setLoading(true);
      if (mode === 'template') {
        // 按模板：每组一次请求并行，其余参数沿用表单值
        if (!templateId) throw new Error('请选择运费模板');
        if (dedupedGroups.length === 0) throw new Error('该模板没有可用的目的地组合');
        const responses = await Promise.all(
          dedupedGroups.map(({ group, countryCodes }: DedupedGroup) =>
            batchCountries({
              lineName: group.lineName,
              countryCodes,
              goodsType: group.goodsType,
              weightG: weight,
              productCostRmb: cost,
              profitRate,
              discountRate,
              ...dims,
            })
          )
        );
        const rows: BatchRow[] = [];
        dedupedGroups.forEach(({ group }: DedupedGroup, i: number) => {
          responses[i].forEach((r: BatchCountryResult) => {
            let buyer: number | null = null;
            if (r.available) {
              if (group.chargeMode === 'free') {
                buyer = 0;
              } else if (group.chargeMode === 'discount') {
                buyer = r.freightRmb * (1 - (group.discountPercent ?? 0));
              } else {
                buyer = r.freightRmb;
              }
            }
            rows.push({
              ...r,
              templateLineName: group.lineName,
              buyerFreightRmb: buyer,
              chargeMode: group.chargeMode,
              discountPercent: group.discountPercent,
            });
          });
        });
        setResult(rows);
      } else {
        if (!lineName) throw new Error('请选择物流线路');
        if (selectedCodes.length === 0) throw new Error('请至少选择一个目的国家');
        const res = await batchCountries({
          lineName,
          countryCodes: selectedCodes,
          weightG: weight,
          productCostRmb: cost,
          goodsType,
          profitRate,
          discountRate,
          ...dims,
        });
        setResult(res);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResult(null);
      logger.error('多国批量定价失败', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="mb-6 inline-flex rounded-md border border-[#e2e2df] bg-card p-1">
          <button
            type="button"
            onClick={() => handleModeChange('line')}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${mode === 'line' ? 'bg-[#fafaf9] font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            按线路
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('template')}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${mode === 'template' ? 'bg-[#fafaf9] font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            按运费模板
          </button>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {mode === 'line' ? (
            <>
              <CarbonField label="物流线路">
                <SearchableSelect
                  value={lineName}
                  onValueChange={(v: string) => setLineName(v)}
                  options={lines.map((line: ShippingLineOption) => ({
                    value: line.lineName,
                    label: line.lineName,
                    keywords: line.lineCategory,
                  }))}
                  placeholder="请选择线路"
                  searchPlaceholder="输入线路 / 分类检索"
                />
              </CarbonField>
              <CarbonField label="目的国家（可多选）">
                <CountryMultiSelect
                  options={countries}
                  selected={selectedCodes}
                  onChange={setSelectedCodes}
                  disabled={!lineName || countriesLoading}
                />
              </CarbonField>
            </>
          ) : (
            <>
              <CarbonField label="运费模板">
                <SearchableSelect
                  value={templateId}
                  onValueChange={handleTemplateChange}
                  options={templates.map((t: ShippingTemplate) => ({ value: t.id, label: t.name }))}
                  placeholder={templates.length === 0 ? '暂无运费模板' : '请选择模板'}
                  searchPlaceholder="输入模板名称检索"
                />
              </CarbonField>
              <CarbonField label="目的国家">
                <div className="min-h-[38px] rounded-md border border-input bg-card px-3 py-2">
                  {selectedTemplate ? (
                    <div className="space-y-2">
                      <p className="text-xs text-foreground">
                        自动覆盖 <span className="font-semibold">{coveredCount}</span> 国
                      </p>
                      {dedupedGroups.length === 0 ? (
                        <p className="text-xs text-[#9a7b12]">该模板未配置任何国家</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {dedupedGroups.map((g: DedupedGroup, i: number) => (
                            <span
                              key={`${g.group.lineName}-${i}`}
                              className="rounded-full bg-[#dcebff] px-2.5 py-0.5 text-[11px] font-medium text-[#2f66c9]"
                            >
                              {g.group.lineName}·{g.group.goodsType}·{g.countryCodes.length}国
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">选择模板后自动覆盖组内国家</p>
                  )}
                </div>
              </CarbonField>
            </>
          )}
          <CarbonField label="包裹重量（g）">
            <Input className={carbonInputClass} inputMode="decimal" placeholder="如 500" value={weightG}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWeightG(e.target.value)} />
          </CarbonField>
          <CarbonField label="采购成本（¥）">
            <Input className={carbonInputClass} inputMode="decimal" placeholder="如 25" value={productCostRmb}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductCostRmb(e.target.value)} />
          </CarbonField>
          {mode === 'line' && (
            <CarbonField label="货型">
              <SearchableSelect
                value={goodsType}
                onValueChange={(v: string) => setGoodsType(v as GoodsType)}
                options={GOODS_TYPES.map((t: GoodsType) => ({ value: t, label: t }))}
                placeholder="请选择货型"
              />
            </CarbonField>
          )}
          <CarbonField label="目标利润率（%，可空）">
            <Input className={carbonInputClass} inputMode="decimal" placeholder="如 30" value={profitRatePct}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfitRatePct(e.target.value)} />
          </CarbonField>
          <CarbonField label="折扣率（%，可空）">
            <Input className={carbonInputClass} inputMode="decimal" placeholder="如 30，即打 7 折" value={discountRatePct}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscountRatePct(e.target.value)} />
          </CarbonField>
          <CarbonField label="长（cm，选填）">
            <Input className={carbonInputClass} inputMode="decimal" placeholder="启用体积重" value={lengthCm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLengthCm(e.target.value)} />
          </CarbonField>
          <CarbonField label="宽（cm，选填）">
            <Input className={carbonInputClass} inputMode="decimal" placeholder="启用体积重" value={widthCm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWidthCm(e.target.value)} />
          </CarbonField>
          <CarbonField label="高（cm，选填）">
            <Input className={carbonInputClass} inputMode="decimal" placeholder="启用体积重" value={heightCm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeightCm(e.target.value)} />
          </CarbonField>
        </div>
        <div className="mt-6">
          <Button
            onClick={() => void handleCalculate()}
            disabled={loading}
            className="pr-10 text-left"
          >
            {mode === 'template'
              ? loading
                ? '按模板计算中…'
                : '按模板批量计算'
              : loading
                ? '批量计算中…'
                : '批量计算售价'}
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <Table
            columns={mode === 'template' ? templateColumns : lineColumns}
            dataSource={result ?? []}
            rowKey="countryCode"
            loading={loading}
            scroll={{ x: 1100, y: 500 }}
            pagination={false}
            rowClassName={(r: BatchRow) => (r.available ? '' : 'opacity-50')}
          />
        </div>
      )}
    </div>
  );
};

export default BatchCountriesTab;
