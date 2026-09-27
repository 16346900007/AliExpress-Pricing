import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  CountryOption,
  GoodsType,
  RecommendLineStat,
  RecommendLinesResponse,
  TemplateChargeMode,
  TemplateRecommendResponse,
} from '@shared/api.interface';
import { getCountries } from '@/api/pricing';
import {
  createTemplate,
  recommendLines,
  recommendTemplate,
} from '@/api/shipping-template';
import { CarbonField, carbonInputClass } from '@/components/carbon-field';
import { SearchableSelect } from '@/components/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CountryMultiSelect from '@/pages/BatchPage/CountryMultiSelect';
import { getErrorMessage } from '@/utils/format';
import RecommendResultPanel from './RecommendResultPanel';
import RecommendLinesPanel from './RecommendLinesPanel';

const GOODS_TYPES: GoodsType[] = ['普货', '非普货', '大包'];
const CHARGE_MODES: { value: TemplateChargeMode; label: string }[] = [
  { value: 'standard', label: '标准运费' },
  { value: 'free', label: '免邮（卖家承担）' },
  { value: 'discount', label: '减免运费' },
];

/** 模板推荐向导：选货型+重量（国家可选）→ 推荐运费最低的线路 → 一键保存为模板 */
const WizardPage = () => {
  const navigate = useNavigate();

  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [goodsType, setGoodsType] = useState<GoodsType>('普货');
  const [weightText, setWeightText] = useState('');

  const [countryResult, setCountryResult] =
    useState<TemplateRecommendResponse | null>(null);
  const [lineResult, setLineResult] = useState<RecommendLinesResponse | null>(
    null
  );
  const [lineCountries, setLineCountries] = useState<Record<string, string[]>>(
    {}
  );
  const [loading, setLoading] = useState(false);

  const [templateName, setTemplateName] = useState('');
  const [remark, setRemark] = useState('');
  const [chargeMode, setChargeMode] = useState<TemplateChargeMode>('standard');
  const [discountPct, setDiscountPct] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCountries()
      .then((list: CountryOption[]) => {
        if (!cancelled) setCountryOptions(list);
      })
      .catch((error: unknown) => logger.error('加载国家列表失败', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLine = (line: RecommendLineStat): void => {
    setLineCountries((prev: Record<string, string[]>) => {
      const picked = prev[line.lineName] ?? [];
      const next = { ...prev };
      if (picked.length === line.countries.length) {
        delete next[line.lineName];
      } else {
        next[line.lineName] = line.countries.map(
          (c) => c.countryCode
        );
      }
      return next;
    });
  };

  const toggleCountry = (line: RecommendLineStat, countryCode: string): void => {
    setLineCountries((prev: Record<string, string[]>) => {
      const picked = prev[line.lineName] ?? [];
      const next = { ...prev };
      if (picked.includes(countryCode)) {
        const rest = picked.filter((c: string) => c !== countryCode);
        if (rest.length === 0) delete next[line.lineName];
        else next[line.lineName] = rest;
      } else {
        next[line.lineName] = [...picked, countryCode];
      }
      return next;
    });
  };

  const handleRecommend = async (): Promise<void> => {
    const weightG = Number(weightText);
    if (weightText.trim() === '' || !Number.isFinite(weightG) || weightG <= 0) {
      toast.error('请填写正确的包裹重量（克，正数）');
      return;
    }
    setLoading(true);
    setCountryResult(null);
    setLineResult(null);
    setLineCountries({});
    try {
      if (countryCodes.length === 0) {
        const data = await recommendLines({ goodsType, weightG });
        setLineResult(data);
        if (data.lines.length === 0) {
          toast.warning(
            `「${goodsType}」货型 ${weightG}g 下没有可用线路`
          );
        }
      } else {
        const data = await recommendTemplate({
          goodsType,
          weightG,
          countryCodes,
        });
        setCountryResult(data);
        if (data.groups.length === 0) {
          toast.warning('所选国家在该货型和重量下均无线路覆盖');
        }
      }
      setTemplateName((prev: string) =>
        prev.trim() === ''
          ? `推荐模板 ${dayjs().format('YYYY-MM-DD')}`
          : prev
      );
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('生成模板推荐失败', error);
    } finally {
      setLoading(false);
    }
  };

  /** 待保存的分组：国家模式用推荐分组；线路模式用勾选线路及其覆盖国家 */
  const saveGroups =
    countryResult && countryResult.groups.length > 0
      ? countryResult.groups
      : lineResult &&
          Object.values(lineCountries).some((c: string[]) => c.length > 0)
        ? lineResult.lines
            .filter(
              (l) => (lineCountries[l.lineName] ?? []).length > 0
            )
            .map((l) => ({
                lineName: l.lineName,
                goodsType,
                chargeMode: 'standard' as const,
                countries: (lineCountries[l.lineName] ?? []).map(
                  (code: string) => ({
                    countryCode: code,
                    countryZh:
                      l.countries.find(
                        (c) => c.countryCode === code
                      )?.countryZh ?? code,
                  })
                ),
              }))
        : null;

  const handleSave = async (): Promise<void> => {
    if (!saveGroups) return;
    if (templateName.trim() === '') {
      toast.error('请填写模板名称');
      return;
    }
    let discountPercent: number | undefined;
    if (chargeMode === 'discount') {
      const pct = Number(discountPct);
      if (
        discountPct.trim() === '' ||
        !Number.isFinite(pct) ||
        pct < 0 ||
        pct > 100
      ) {
        toast.error('减免比例需为 0~100 的百分数');
        return;
      }
      discountPercent = pct / 100;
    }
    setSaving(true);
    try {
      const saved = await createTemplate({
        name: templateName.trim(),
        remark: remark.trim() || undefined,
        groups: saveGroups.map((g) => ({
          ...g,
          chargeMode,
          ...(chargeMode === 'discount' ? { discountPercent } : {}),
        })),
      });
      toast.success(`模板「${saved.name}」已保存`);
      navigate('/templates');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('保存推荐模板失败', error);
    } finally {
      setSaving(false);
    }
  };

  const selectedZh = countryCodes
    .map(
      (code: string) =>
        countryOptions.find((o: CountryOption) => o.countryCode === code)
          ?.countryZh ?? code
    )
    .join('、');

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-[1.25] text-foreground">
          模板推荐向导
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          选择货型和重量即可按线路整体推荐（覆盖国家数与代表运费）；选了国家则为每国推荐运费最低线路，均可一键保存为运费模板
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          ① 选择条件
        </p>
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <CarbonField label="货型 *">
            <SearchableSelect
              value={goodsType}
              onValueChange={(v: string) => setGoodsType(v as GoodsType)}
              options={GOODS_TYPES.map((t: GoodsType) => ({ value: t, label: t }))}
              placeholder="请选择货型"
            />
          </CarbonField>
          <CarbonField label="包裹重量（克）*">
            <Input
              className={carbonInputClass}
              inputMode="decimal"
              placeholder="如 500"
              value={weightText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setWeightText(e.target.value)
              }
            />
          </CarbonField>
          <div className="sm:col-span-2">
            <CarbonField label="目的国家（选填：不选则按线路整体推荐）">
              <CountryMultiSelect
                options={countryOptions}
                selected={countryCodes}
                onChange={setCountryCodes}
              />
            </CarbonField>
          </div>
        </div>
        {countryCodes.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {selectedZh}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void handleRecommend()} disabled={loading}>
            <Sparkles className="h-4 w-4" />
            {loading ? '计算中…' : '生成推荐'}
          </Button>
        </div>
      </div>

      {countryResult && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            ② 推荐结果（每国取运费最低线路）
          </p>
          <div className="mt-4">
            <RecommendResultPanel result={countryResult} />
          </div>
        </div>
      )}

      {lineResult && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            ② 推荐结果（各线路代表运费，按最低运费排序）
          </p>
          <div className="mt-4">
            <RecommendLinesPanel
              result={lineResult}
              selection={lineCountries}
              onToggleLine={toggleLine}
              onToggleCountry={toggleCountry}
            />
          </div>
        </div>
      )}

      {saveGroups && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            ③ 保存为运费模板（{saveGroups.length} 个组合，共{' '}
            {saveGroups.reduce(
              (sum: number, g) => sum + g.countries.length,
              0
            )}
            个国家）
          </p>
          <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <CarbonField label="模板名称 *">
              <Input
                className={carbonInputClass}
                placeholder="如 欧美低运费模板"
                value={templateName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTemplateName(e.target.value)
                }
              />
            </CarbonField>
            <CarbonField label="计费方式（应用到全部分组）">
              <SearchableSelect
                value={chargeMode}
                onValueChange={(v: string) =>
                  setChargeMode(v as TemplateChargeMode)
                }
                options={CHARGE_MODES.map((m) => ({ value: m.value, label: m.label }))}
                placeholder="请选择计费方式"
              />
            </CarbonField>
            {chargeMode === 'discount' && (
              <CarbonField label="减免比例（%）*">
                <Input
                  className={carbonInputClass}
                  inputMode="decimal"
                  placeholder="如 30 表示买家少付 30%"
                  value={discountPct}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDiscountPct(e.target.value)
                  }
                />
              </CarbonField>
            )}
            <CarbonField label="备注（选填）">
              <Input
                className={carbonInputClass}
                placeholder="如 由推荐向导生成"
                value={remark}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setRemark(e.target.value)
                }
              />
            </CarbonField>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? '保存中…' : '保存为运费模板'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WizardPage;
