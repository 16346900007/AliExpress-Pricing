import { useMemo } from 'react';
import type {
  CountryOption,
  GoodsType,
  ShippingLineOption,
  ShippingTemplateGroup,
  TemplateCountryRef,
} from '@shared/api.interface';
import { CarbonField, carbonInputClass } from '@/components/carbon-field';
import type { SearchableSelectOption } from '@/components/searchable-select';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/searchable-select';
import { parseNonNegativeNumber, parsePositiveNumber } from '@/utils/format';

/** 四个计算面板共用的原始输入值（数字字段以字符串保存，提交前解析） */
export interface CommonValues {
  lineName: string;
  countryCode: string;
  weightG: string;
  productCostRmb: string;
  goodsType: GoodsType;
  profitRatePct: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
}

/** 解析后的公共请求字段 */
export interface BaseFields {
  lineName: string;
  countryCode: string;
  weightG: number;
  productCostRmb: number;
  goodsType: GoodsType;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

/** 校验并解析公共输入，非法时抛出带可读信息的 Error */
export function parseCommonValues(values: CommonValues): BaseFields {
  if (!values.lineName) {
    throw new Error('请选择物流线路');
  }
  if (!values.countryCode) {
    throw new Error('请选择目的国家');
  }
  const dimsProvided =
    values.lengthCm !== '' || values.widthCm !== '' || values.heightCm !== '';
  if (dimsProvided && (values.lengthCm === '' || values.widthCm === '' || values.heightCm === '')) {
    throw new Error('启用体积重需完整填写长 / 宽 / 高');
  }
  return {
    lineName: values.lineName,
    countryCode: values.countryCode,
    weightG: parsePositiveNumber(values.weightG, '包裹重量'),
    productCostRmb: parseNonNegativeNumber(values.productCostRmb, '采购成本'),
    goodsType: values.goodsType,
    lengthCm:
      values.lengthCm === ''
        ? undefined
        : parsePositiveNumber(values.lengthCm, '长度'),
    widthCm:
      values.widthCm === ''
        ? undefined
        : parsePositiveNumber(values.widthCm, '宽度'),
    heightCm:
      values.heightCm === ''
        ? undefined
        : parsePositiveNumber(values.heightCm, '高度'),
  };
}

const GOODS_TYPES: GoodsType[] = ['普货', '非普货', '大包'];

/** 「手动选择线路」哨兵值（SelectItem 禁止空串，用非空占位） */
export const MANUAL_TEMPLATE = '__manual__';

interface FreightInputsProps {
  values: CommonValues;
  onChange: (patch: Partial<CommonValues>) => void;
  lines: ShippingLineOption[];
  countries: CountryOption[];
  countriesLoading: boolean;
  /** 运费模板下拉当前值：MANUAL_TEMPLATE 或模板 id */
  templateValue: string;
  /** 模板下拉选项（含「手动选择线路」） */
  templateOptions: SearchableSelectOption[];
  onTemplateChange: (v: string) => void;
  /** 当前选中模板的分组（模板模式用于国家→组联动） */
  templateGroups: ShippingTemplateGroup[];
}

/** 线路 / 国家 / 重量 / 成本 / 货型 / 目标利润率 公共输入区 */
export function FreightInputs({
  values,
  onChange,
  lines,
  countries,
  countriesLoading,
  templateValue,
  templateOptions,
  onTemplateChange,
  templateGroups,
}: FreightInputsProps) {
  const templateMode = templateValue !== MANUAL_TEMPLATE;
  const templateCountryCount = useMemo<number>(() => {
    const seen = new Set<string>();
    templateGroups.forEach((g: ShippingTemplateGroup) =>
      g.countries.forEach((c: TemplateCountryRef) => seen.add(c.countryCode))
    );
    return seen.size;
  }, [templateGroups]);

  const handleCountryChange = (v: string): void => {
    if (!templateMode) {
      onChange({ countryCode: v });
      return;
    }
    const matches = templateGroups.filter(
      (g: ShippingTemplateGroup) =>
        g.countries.some((c: TemplateCountryRef) => c.countryCode === v)
    );
    if (matches.length === 0) {
      onChange({ countryCode: v });
      return;
    }
    // 多线路可达同一国家时仅默认带出第一组，线路下拉可选其它
    const first = matches[0];
    onChange({ countryCode: v, lineName: first.lineName, goodsType: first.goodsType });
  };

  // 模板模式：覆盖已选国家的全部分组（同一国家可能有多条线路）
  const countryGroups = useMemo<ShippingTemplateGroup[]>(
    () =>
      templateMode && values.countryCode
        ? templateGroups.filter(
            (g: ShippingTemplateGroup) =>
              g.countries.some(
                (c: TemplateCountryRef) => c.countryCode === values.countryCode
              )
          )
        : [],
    [templateMode, values.countryCode, templateGroups]
  );

  const handleLineChange = (v: string): void => {
    if (!templateMode) {
      onChange({ lineName: v });
      return;
    }
    const group = countryGroups.find(
      (g: ShippingTemplateGroup) => g.lineName === v
    );
    onChange({
      lineName: v,
      goodsType: group?.goodsType ?? values.goodsType,
      countryCode: values.countryCode,
    });
  };

  const countryDisabled = templateMode
    ? templateCountryCount === 0
    : !values.lineName || countriesLoading;
  const countryPlaceholder = templateMode
    ? templateCountryCount === 0
      ? '模板未覆盖任何国家'
      : '请选择国家'
    : countriesLoading
      ? '加载中…'
      : '请选择国家';

  const lineDisabled = templateMode ? countryGroups.length === 0 : false;
  const linePlaceholder = templateMode
    ? '请先选择国家'
    : '请选择线路';

  // 模板模式下候选线路 = 覆盖当前国家的分组线路去重；手动模式 = 全量线路
  const lineOptions = templateMode
    ? Array.from(
        new Set(countryGroups.map((g: ShippingTemplateGroup) => g.lineName))
      ).map((lineName: string) => ({ value: lineName, label: lineName }))
    : lines.map((line: ShippingLineOption) => ({
        value: line.lineName,
        label: line.lineName,
        keywords: line.lineCategory,
      }));

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      <CarbonField label="运费模板">
        <SearchableSelect
          value={templateValue}
          onValueChange={onTemplateChange}
          options={templateOptions}
          placeholder="手动选择线路"
          searchPlaceholder="输入模板名称检索"
        />
      </CarbonField>
      <CarbonField label="物流线路">
        <SearchableSelect
          value={values.lineName}
          onValueChange={handleLineChange}
          disabled={lineDisabled}
          options={lineOptions}
          placeholder={linePlaceholder}
          searchPlaceholder="输入线路 / 分类检索"
        />
      </CarbonField>
      <CarbonField label="目的国家">
        <SearchableSelect
          value={values.countryCode}
          onValueChange={handleCountryChange}
          disabled={countryDisabled}
          options={countries.map((c: CountryOption) => ({
            value: c.countryCode,
            label: c.countryZh,
            keywords: `${c.countryEn} ${c.countryCode}`,
          }))}
          placeholder={countryPlaceholder}
          searchPlaceholder="输入国家中文名 / 英文名 / 代码检索"
        />
      </CarbonField>
      <CarbonField label="包裹重量（g）">
        <Input
          className={carbonInputClass}
          inputMode="decimal"
          placeholder="如 500"
          value={values.weightG}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ weightG: e.target.value })
          }
        />
      </CarbonField>
      <CarbonField label="采购成本（¥）">
        <Input
          className={carbonInputClass}
          inputMode="decimal"
          placeholder="如 25"
          value={values.productCostRmb}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ productCostRmb: e.target.value })
          }
        />
      </CarbonField>
      <CarbonField label="货型">
        <SearchableSelect
          value={values.goodsType}
          onValueChange={(v: string) => onChange({ goodsType: v as GoodsType })}
          disabled={templateMode}
          options={GOODS_TYPES.map((t: GoodsType) => ({ value: t, label: t }))}
          placeholder="请选择货型"
        />
      </CarbonField>
      <CarbonField label="目标利润率（%）">
        <Input
          className={carbonInputClass}
          inputMode="decimal"
          placeholder="如 30"
          value={values.profitRatePct}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ profitRatePct: e.target.value })
          }
        />
      </CarbonField>
      <CarbonField label="长（cm）">
        <Input
          className={carbonInputClass}
          inputMode="decimal"
          placeholder="选填，启用体积重"
          value={values.lengthCm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ lengthCm: e.target.value })
          }
        />
      </CarbonField>
      <CarbonField label="宽（cm）">
        <Input
          className={carbonInputClass}
          inputMode="decimal"
          placeholder="选填"
          value={values.widthCm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ widthCm: e.target.value })
          }
        />
      </CarbonField>
      <CarbonField label="高（cm）">
        <Input
          className={carbonInputClass}
          inputMode="decimal"
          placeholder="选填"
          value={values.heightCm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ heightCm: e.target.value })
          }
        />
      </CarbonField>
    </div>
  );
}
