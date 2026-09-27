import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  CountryOption,
  GoodsType,
  ShippingLineOption,
  ShippingTemplate,
  TemplateChargeMode,
  TemplateCountryRef,
} from '@shared/api.interface';
import { getCountries } from '@/api/pricing';
import { createTemplate, updateTemplate } from '@/api/shipping-template';
import { CarbonField, carbonInputClass } from '@/components/carbon-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/searchable-select';
import { getErrorMessage } from '@/utils/format';
import CountryMultiSelect from '@/pages/BatchPage/CountryMultiSelect';

const GOODS_TYPES: GoodsType[] = ['普货', '非普货', '大包'];
const CHARGE_MODES: { value: TemplateChargeMode; label: string }[] = [
  { value: 'standard', label: '标准运费' },
  { value: 'free', label: '免邮（卖家承担）' },
  { value: 'discount', label: '减免运费' },
];

/** 表单内的目的地组合（数字 / 文本以字符串暂存） */
interface EditorGroup {
  lineName: string;
  goodsType: GoodsType;
  chargeMode: TemplateChargeMode;
  /** 减免比例输入，百分数文本（"30" = 买家少付 30%） */
  discountPct: string;
  countries: TemplateCountryRef[];
  countryOptions: CountryOption[];
  optionsLoading: boolean;
}

const makeEmptyGroup = (): EditorGroup => ({
  lineName: '',
  goodsType: '普货',
  chargeMode: 'standard',
  discountPct: '',
  countries: [],
  countryOptions: [],
  optionsLoading: false,
});

interface TemplateEditorDialogProps {
  open: boolean;
  /** 编辑中的模板；null = 新建 */
  template: ShippingTemplate | null;
  lines: ShippingLineOption[];
  onOpenChange: (open: boolean) => void;
  /** 保存成功后回调（触发列表刷新） */
  onSaved: () => void;
}

/** 新建 / 编辑运费模板弹窗：模板名 + 目的地组合列表（线路 × 货型 × 国家 × 计费方式） */
const TemplateEditorDialog = ({
  open,
  template,
  lines,
  onOpenChange,
  onSaved,
}: TemplateEditorDialogProps) => {
  const [name, setName] = useState('');
  const [remark, setRemark] = useState('');
  const [groups, setGroups] = useState<EditorGroup[]>([makeEmptyGroup()]);
  const [submitting, setSubmitting] = useState(false);

  // 打开时按模板初始化表单；编辑态预取各组合线路的可选国家
  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setRemark(template.remark ?? '');
      setGroups(
        template.groups.map((g) => ({
          lineName: g.lineName,
          goodsType: g.goodsType,
          chargeMode: g.chargeMode,
          discountPct:
            g.discountPercent != null ? String(Math.round(g.discountPercent * 100)) : '',
          countries: g.countries,
          countryOptions: [],
          optionsLoading: true,
        }))
      );
      template.groups.forEach((g, idx: number) => {
        if (!g.lineName) return;
        getCountries(g.lineName)
          .then((list: CountryOption[]) => {
            setGroups((gs) =>
              gs.map((x, i) => (i === idx ? { ...x, countryOptions: list, optionsLoading: false } : x))
            );
          })
          .catch((error: unknown) => {
            logger.error('加载组合国家选项失败', error);
            setGroups((gs) =>
              gs.map((x, i) => (i === idx ? { ...x, optionsLoading: false } : x))
            );
          });
      });
    } else {
      setName('');
      setRemark('');
      setGroups([makeEmptyGroup()]);
    }
  }, [open, template]);

  const updateGroup = useCallback(
    (idx: number, patch: Partial<EditorGroup>): void => {
      setGroups((gs) =>
        gs.map((g: EditorGroup, i: number) => (i === idx ? { ...g, ...patch } : g))
      );
    },
    []
  );

  /** 切换线路：清空已选国家并按新线路加载国家选项 */
  const handleLineChange = useCallback((idx: number, lineName: string): void => {
    updateGroup(idx, { lineName, countries: [], countryOptions: [], optionsLoading: true });
    getCountries(lineName)
      .then((list: CountryOption[]) => {
        setGroups((gs) =>
          gs.map((g: EditorGroup, i: number) =>
            i === idx && g.lineName === lineName
              ? { ...g, countryOptions: list, optionsLoading: false }
              : g
          )
        );
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('加载国家选项失败', error);
        setGroups((gs) =>
          gs.map((g: EditorGroup, i: number) =>
            i === idx && g.lineName === lineName ? { ...g, optionsLoading: false } : g
          )
        );
      });
  }, [updateGroup]);

  /** 国家多选变化：code 列表 → 带 中文名 的引用 */
  const handleCountriesChange = useCallback(
    (idx: number, codes: string[]): void => {
      setGroups((gs) =>
        gs.map((g: EditorGroup, i: number) => {
          if (i !== idx) return g;
          const refs: TemplateCountryRef[] = codes.map((code: string) => {
            const existed = g.countries.find((c: TemplateCountryRef) => c.countryCode === code);
            if (existed) return existed;
            const opt = g.countryOptions.find((o: CountryOption) => o.countryCode === code);
            return {
              countryCode: code,
              countryZh: opt ? opt.countryZh : code,
            };
          });
          return { ...g, countries: refs };
        })
      );
    },
    []
  );

  const validate = (): string | null => {
    if (!name.trim()) return '请填写模板名称';
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i];
      if (!g.lineName) return `第 ${i + 1} 组合请选择物流线路`;
      if (!g.goodsType) return `第 ${i + 1} 组合请选择货型`;
      if (!g.chargeMode) return `第 ${i + 1} 组合请选择计费方式`;
      if (g.countries.length === 0) return `第 ${i + 1} 组合请至少选择一个国家`;
      if (g.chargeMode === 'discount') {
        const pct = Number(g.discountPct);
        if (g.discountPct === '' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
          return `第 ${i + 1} 组合的减免比例需为 0~100 的百分数`;
        }
      }
    }
    // 跨组合国家去重
    const seen = new Map<string, { groupIdx: number; zh: string }>();
    for (let i = 0; i < groups.length; i += 1) {
      for (const c of groups[i].countries) {
        const prev = seen.get(c.countryCode);
        if (prev) {
          return `国家「${c.countryZh}」同时出现在第 ${prev.groupIdx + 1} 与第 ${i + 1} 组合，请去重`;
        }
        seen.set(c.countryCode, { groupIdx: i, zh: c.countryZh });
      }
    }
    return null;
  };

  const handleSubmit = async (): Promise<void> => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const payloadGroups = groups.map((g: EditorGroup) => ({
        lineName: g.lineName,
        goodsType: g.goodsType,
        chargeMode: g.chargeMode,
        discountPercent:
          g.chargeMode === 'discount' ? Number(g.discountPct) / 100 : undefined,
        countries: g.countries,
      }));
      const payload = {
        name: name.trim(),
        remark: remark.trim() || undefined,
        groups: payloadGroups,
      };
      if (template) {
        await updateTemplate(template.id, payload);
        toast.success('模板已更新');
      } else {
        await createTemplate(payload);
        toast.success('模板已创建');
      }
      onOpenChange(false);
      onSaved();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('保存运费模板失败', error);
    } finally {
      setSubmitting(false);
    }
  };

  const chargeModeLabel = (mode: TemplateChargeMode): string =>
    CHARGE_MODES.find((m) => m.value === mode)?.label ?? mode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{template ? '编辑模板' : '新建模板'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <CarbonField label="模板名称 *">
              <Input
                className={carbonInputClass}
                placeholder="如 欧美标准运费模板"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              />
            </CarbonField>
            <CarbonField label="备注（选填）">
              <Input
                className={carbonInputClass}
                placeholder="如 主推美区使用"
                value={remark}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemark(e.target.value)}
              />
            </CarbonField>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">目的地组合</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroups((gs) => [...gs, makeEmptyGroup()])}
            >
              <Plus className="h-4 w-4" />
              新增组合
            </Button>
          </div>

          <div className="space-y-4">
            {groups.map((g: EditorGroup, idx: number) => (
              <div key={idx} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    组合 {idx + 1}
                  </span>
                  {groups.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        setGroups((gs) => gs.filter((_: EditorGroup, i: number) => i !== idx))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      删除该组合
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <CarbonField label="物流线路 *">
                    <SearchableSelect
                      value={g.lineName}
                      onValueChange={(v: string) => handleLineChange(idx, v)}
                      options={lines.map((l: ShippingLineOption) => ({
                        value: l.lineName,
                        label: l.lineName,
                        keywords: l.lineCategory,
                      }))}
                      placeholder="请选择线路"
                      searchPlaceholder="输入线路 / 分类检索"
                    />
                  </CarbonField>
                  <CarbonField label="货型 *">
                    <SearchableSelect
                      value={g.goodsType}
                      onValueChange={(v: string) =>
                        updateGroup(idx, { goodsType: v as GoodsType })
                      }
                      options={GOODS_TYPES.map((t: GoodsType) => ({ value: t, label: t }))}
                      placeholder="请选择货型"
                    />
                  </CarbonField>
                  <CarbonField label="计费方式 *">
                    <SearchableSelect
                      value={g.chargeMode}
                      onValueChange={(v: string) =>
                        updateGroup(idx, { chargeMode: v as TemplateChargeMode })
                      }
                      options={CHARGE_MODES.map((m) => ({ value: m.value, label: m.label }))}
                      placeholder="请选择计费方式"
                    />
                  </CarbonField>
                  {g.chargeMode === 'discount' && (
                    <CarbonField label="减免比例（%）*">
                      <Input
                        className={carbonInputClass}
                        inputMode="decimal"
                        placeholder="如 30 表示买家少付 30%"
                        value={g.discountPct}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateGroup(idx, { discountPct: e.target.value })
                        }
                      />
                    </CarbonField>
                  )}
                </div>
                <div className="mt-4">
                  <CarbonField label="目的国家 *（可多选，按所选线路过滤）">
                    <CountryMultiSelect
                      options={g.countryOptions}
                      selected={g.countries.map((c: TemplateCountryRef) => c.countryCode)}
                      onChange={(codes: string[]) => handleCountriesChange(idx, codes)}
                      disabled={!g.lineName || g.optionsLoading}
                    />
                  </CarbonField>
                  {g.countries.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {g.countries.map((c: TemplateCountryRef) => c.countryZh).join('、')}
                    </p>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  计费方式：{chargeModeLabel(g.chargeMode)}
                  {g.chargeMode === 'discount' && g.discountPct !== '' && Number.isFinite(Number(g.discountPct)) && (
                    <>，买家少付 {g.discountPct}%</>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? '保存中…' : '保存模板'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateEditorDialog;
