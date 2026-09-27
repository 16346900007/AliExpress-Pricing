import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  CountryOption,
  ShippingLineOption,
  ShippingTemplate,
  ShippingTemplateGroup,
  TemplateCountryRef,
} from '@shared/api.interface';
import { getCountries, getLines, getSettings } from '@/api/pricing';
import { listTemplates } from '@/api/shipping-template';
import type { SearchableSelectOption } from '@/components/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getErrorMessage } from '@/utils/format';
import BreakevenPanel from './BreakevenPanel';
import DiscountPanel from './DiscountPanel';
import { FreightInputs, MANUAL_TEMPLATE, type CommonValues } from './FreightInputs';
import ForwardPanel from './ForwardPanel';
import ReversePanel from './ReversePanel';

const CalculatorPage = () => {
  const [lines, setLines] = useState<ShippingLineOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [templates, setTemplates] = useState<ShippingTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>(MANUAL_TEMPLATE);
  const templateMode = templateId !== MANUAL_TEMPLATE;
  const [common, setCommon] = useState<CommonValues>({
    lineName: '',
    countryCode: '',
    weightG: '',
    productCostRmb: '',
    goodsType: '普货',
    profitRatePct: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
  });

  // 加载线路列表与定价参数（参数用于预填默认目标利润率）
  useEffect(() => {
    let cancelled = false;
    Promise.all([getLines(), getSettings()])
      .then(([lineList, settings]) => {
        if (cancelled) return;
        setLines(lineList);
        setCommon(prev =>
          prev.profitRatePct === ''
            ? { ...prev, profitRatePct: String(settings.defaultProfitRate * 100) }
            : prev
        );
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('加载线路与定价参数失败', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 加载运费模板列表（供模板下拉选择）
  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((list: ShippingTemplate[]) => {
        if (!cancelled) setTemplates(list);
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('加载运费模板失败', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplate = useMemo<ShippingTemplate | null>(
    () => templates.find((t: ShippingTemplate) => t.id === templateId) ?? null,
    [templates, templateId]
  );

  // 模板模式：国家选项 = 模板全部国家按 code 去重（先出现的组优先）
  const templateCountryOptions = useMemo<CountryOption[]>(() => {
    if (!selectedTemplate) return [];
    const seen = new Set<string>();
    const list: CountryOption[] = [];
    selectedTemplate.groups.forEach((g: ShippingTemplateGroup) =>
      g.countries.forEach((c: TemplateCountryRef) => {
        if (seen.has(c.countryCode)) return;
        seen.add(c.countryCode);
        list.push({ countryCode: c.countryCode, countryZh: c.countryZh, countryEn: c.countryCode });
      })
    );
    return list;
  }, [selectedTemplate]);

  // 当前生效的模板分组（线路+国家双匹配，同一国家多线路时跟随所选线路），供面板展示买家实付运费
  const activeTemplateGroup = useMemo<ShippingTemplateGroup | null>(() => {
    if (!selectedTemplate || !common.countryCode || !common.lineName) return null;
    return (
      selectedTemplate.groups.find(
        (g: ShippingTemplateGroup) =>
          g.lineName === common.lineName &&
          g.countries.some(
            (c: TemplateCountryRef) => c.countryCode === common.countryCode
          )
      ) ?? null
    );
  }, [selectedTemplate, common.countryCode, common.lineName]);

  const templateOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: MANUAL_TEMPLATE, label: '手动选择线路' },
      ...templates.map((t: ShippingTemplate) => ({ value: t.id, label: t.name })),
    ],
    [templates]
  );

  // 切换模板时清空已选线路/国家，切回手动时恢复联动行为
  const handleTemplateChange = (v: string): void => {
    setTemplateId(v);
    setCommon(prev => ({ ...prev, lineName: '', countryCode: '' }));
  };

  // 线路切换时联动加载可选国家，并清空已选国家（模板模式下不走联动）
  useEffect(() => {
    if (templateMode) {
      setCountries([]);
      return;
    }
    if (!common.lineName) {
      setCountries([]);
      return;
    }
    let cancelled = false;
    setCountriesLoading(true);
    getCountries(common.lineName)
      .then((list: CountryOption[]) => {
        if (!cancelled) setCountries(list);
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('加载国家列表失败', error);
        if (!cancelled) setCountries([]);
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [common.lineName, templateMode]);

  const updateCommon = (patch: Partial<CommonValues>): void => {
    setCommon(prev => {
      const next = { ...prev, ...patch };
      // 同一 patch 里已同时给出国家时（模板模式选国家带出线路），不重复清空国家
      if (
        patch.lineName !== undefined &&
        patch.lineName !== prev.lineName &&
        patch.countryCode === undefined
      ) {
        next.countryCode = '';
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <h2 className="text-[22px] font-semibold leading-[1.25] text-foreground">定价计算器</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        输入商品成本与物流信息，自动结合运费标准计算建议售价、真实利润、折扣上限与保本价。
      </p>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <FreightInputs
          values={common}
          onChange={updateCommon}
          lines={lines}
          countries={templateMode ? templateCountryOptions : countries}
          countriesLoading={templateMode ? false : countriesLoading}
          templateValue={templateId}
          templateOptions={templateOptions}
          onTemplateChange={handleTemplateChange}
          templateGroups={selectedTemplate?.groups ?? []}
        />
      </div>

      <Tabs defaultValue="forward">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="forward">正向定价</TabsTrigger>
          <TabsTrigger value="reverse">反向验算</TabsTrigger>
          <TabsTrigger value="discount">折扣藏价</TabsTrigger>
          <TabsTrigger value="breakeven">保本价</TabsTrigger>
        </TabsList>
        <TabsContent value="forward" className="mt-6">
          <ForwardPanel values={common} templateGroup={activeTemplateGroup} />
        </TabsContent>
        <TabsContent value="reverse" className="mt-6">
          <ReversePanel values={common} templateGroup={activeTemplateGroup} />
        </TabsContent>
        <TabsContent value="discount" className="mt-6">
          <DiscountPanel values={common} templateGroup={activeTemplateGroup} />
        </TabsContent>
        <TabsContent value="breakeven" className="mt-6">
          <BreakevenPanel values={common} templateGroup={activeTemplateGroup} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CalculatorPage;
