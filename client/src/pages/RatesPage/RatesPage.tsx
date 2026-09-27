import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileDown, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Table, TableProps } from '@lark-apaas/client-toolkit/antd-table';
import type {
  CalcMode,
  GoodsType,
  ShippingLineOption,
  ShippingRateRecord,
} from '@shared/api.interface';
import {
  createShippingRate,
  deleteShippingRate,
  exportShippingRates,
  getLines,
  listShippingRates,
  updateShippingRate,
} from '@/api/pricing';
import { CarbonField, carbonInputClass, carbonSelectTriggerClass } from '@/components/carbon-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/searchable-select';
import { getErrorMessage } from '@/utils/format';
import { downloadRateImportTemplate, exportRatesXlsx } from '@/utils/rates-export';
import { showConfirm } from '@lark-apaas/client-toolkit';

const GOODS_TYPES: GoodsType[] = ['普货', '非普货', '大包'];
const CALC_MODES: { value: CalcMode; label: string }[] = [
  { value: 'per_gram', label: '按克计费' },
  { value: 'first_additional', label: '首重续重' },
];

/** 新增 / 编辑表单字段（数字字段以字符串存） */
interface RateFormValues {
  lineName: string;
  lineCategory: string;
  goodsType: GoodsType;
  countryZh: string;
  countryEn: string;
  countryCode: string;
  currency: string;
  weightMinG: string;
  weightMaxG: string;
  feePerKg: string;
  registrationFee: string;
  minChargeG: string;
  calcMode: CalcMode;
  firstWeightFee: string;
  additionalFeePer500g: string;
  tierLabel: string;
  volumeDivisor: string;
}

const EMPTY_FORM: RateFormValues = {
  lineName: '',
  lineCategory: '经济类物流',
  goodsType: '普货',
  countryZh: '',
  countryEn: '',
  countryCode: '',
  currency: 'RMB',
  weightMinG: '1',
  weightMaxG: '',
  feePerKg: '',
  registrationFee: '',
  minChargeG: '1',
  calcMode: 'per_gram',
  firstWeightFee: '',
  additionalFeePer500g: '',
  tierLabel: '',
  volumeDivisor: '5000',
};

const RatesPage = () => {
  const [lines, setLines] = useState<ShippingLineOption[]>([]);
  const [items, setItems] = useState<ShippingRateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [filterLine, setFilterLine] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterGoodsType, setFilterGoodsType] = useState<'' | GoodsType>('');

  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RateFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchList = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await listShippingRates({
        page,
        pageSize,
        lineName: filterLine || undefined,
        countryKeyword: filterCountry || undefined,
        goodsType: filterGoodsType || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('加载运费标准失败', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterLine, filterCountry, filterGoodsType]);

  useEffect(() => {
    let cancelled = false;
    getLines()
      .then((data: ShippingLineOption[]) => {
        if (!cancelled) setLines(data);
      })
      .catch((error: unknown) => logger.error('加载线路列表失败', error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const handleAdd = (): void => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (record: ShippingRateRecord): void => {
    setEditingId(record.id);
    setForm({
      lineName: record.lineName,
      lineCategory: record.lineCategory,
      goodsType: record.goodsType,
      countryZh: record.countryZh,
      countryEn: record.countryEn,
      countryCode: record.countryCode,
      currency: record.currency,
      weightMinG: String(record.weightMinG),
      weightMaxG: String(record.weightMaxG),
      feePerKg: record.feePerKg != null ? String(record.feePerKg) : '',
      registrationFee: record.registrationFee != null ? String(record.registrationFee) : '',
      minChargeG: String(record.minChargeG),
      calcMode: record.calcMode,
      firstWeightFee: record.firstWeightFee != null ? String(record.firstWeightFee) : '',
      additionalFeePer500g:
        record.additionalFeePer500g != null ? String(record.additionalFeePer500g) : '',
      tierLabel: record.tierLabel ?? '',
      volumeDivisor:
        record.volumeDivisor != null ? String(record.volumeDivisor) : '5000',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (record: ShippingRateRecord): Promise<void> => {
    if (!await showConfirm(`确认删除 ${record.lineName} · ${record.countryZh} 的运费标准？`)) return;
    try {
      await deleteShippingRate(record.id);
      toast.success('删除成功');
      void fetchList();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('删除运费标准失败', error);
    }
  };

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const res = await exportShippingRates({
        lineName: filterLine || undefined,
        countryKeyword: filterCountry || undefined,
        goodsType: filterGoodsType || undefined,
      });
      exportRatesXlsx(res.items);
      toast.success(`已导出 ${res.items.length} 条运费标准`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('导出运费标准失败', error);
    } finally {
      setExporting(false);
    }
  };

  const validateForm = (): string | null => {
    if (!form.lineName) return '请填写物流线路';
    if (!form.countryZh || !form.countryEn || !form.countryCode)
      return '请完整填写国家中文名 / 英文名 / 代码';
    if (!Number.isInteger(Number(form.weightMinG)) || Number(form.weightMinG) <= 0)
      return '重量下限必须是正整数';
    if (!Number.isInteger(Number(form.weightMaxG)) || Number(form.weightMaxG) <= 0)
      return '重量上限必须是正整数';
    if (Number(form.weightMaxG) < Number(form.weightMinG))
      return '重量上限不能小于下限';
    if (
      form.volumeDivisor !== '' &&
      (!Number.isInteger(Number(form.volumeDivisor)) || Number(form.volumeDivisor) < 0)
    )
      return '体积重除数必须是不小于 0 的整数';
    return null;
  };

  const handleSubmit = async (): Promise<void> => {
    const err = validateForm();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        lineName: form.lineName,
        lineCategory: form.lineCategory || undefined,
        goodsType: form.goodsType,
        countryZh: form.countryZh,
        countryEn: form.countryEn,
        countryCode: form.countryCode,
        currency: form.currency || undefined,
        weightMinG: Number(form.weightMinG),
        weightMaxG: Number(form.weightMaxG),
        feePerKg: form.feePerKg === '' ? undefined : Number(form.feePerKg),
        registrationFee: form.registrationFee === '' ? undefined : Number(form.registrationFee),
        minChargeG: form.minChargeG === '' ? undefined : Number(form.minChargeG),
        calcMode: form.calcMode,
        firstWeightFee:
          form.firstWeightFee === '' ? undefined : Number(form.firstWeightFee),
        additionalFeePer500g:
          form.additionalFeePer500g === ''
            ? undefined
            : Number(form.additionalFeePer500g),
        tierLabel: form.tierLabel || undefined,
        volumeDivisor:
          form.volumeDivisor === '' ? undefined : Number(form.volumeDivisor),
      };
      if (editingId) {
        await updateShippingRate(editingId, payload);
        toast.success('更新成功');
      } else {
        await createShippingRate(payload);
        toast.success('创建成功');
      }
      setDialogOpen(false);
      void fetchList();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('保存运费标准失败', error);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<TableProps<ShippingRateRecord>['columns']>(
    () => [
      {
        title: '物流线路',
        dataIndex: 'lineName',
        width: 200,
        fixed: 'left',
        render: (_v: unknown, r: ShippingRateRecord) => (
          <div className="flex flex-col">
            <span className="font-medium">{r.lineName}</span>
            <span className="text-xs text-muted-foreground">{r.lineCategory}</span>
          </div>
        ),
      },
      {
        title: '目的国家',
        dataIndex: 'countryZh',
        width: 160,
        render: (_v: unknown, r: ShippingRateRecord) => (
          <div className="flex flex-col">
            <span>{r.countryZh}</span>
            <span className="text-xs text-muted-foreground">
              {r.countryEn} · {r.countryCode}
            </span>
          </div>
        ),
      },
      {
        title: '货型',
        dataIndex: 'goodsType',
        width: 90,
        render: (v: string) => (
          <Badge
            variant="secondary"
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              v === '普货'
                ? 'bg-[#e6f4ea] text-[#1f8a4c]'
                : v === '大包'
                  ? 'bg-[#dcebff] text-[#2f66c9]'
                  : 'bg-[#fff6d6] text-[#9a7b12]'
            }`}
          >
            {v}
          </Badge>
        ),
      },
      {
        title: '重量区间（g）',
        dataIndex: 'weightMinG',
        width: 150,
        render: (_v: unknown, r: ShippingRateRecord) =>
          `${r.weightMinG} ~ ${r.weightMaxG}`,
      },
      {
        title: '计费模式',
        dataIndex: 'calcMode',
        width: 100,
        render: (v: string) => (v === 'per_gram' ? '按克计费' : '首重续重'),
      },
      {
        title: '单价（元/KG）',
        dataIndex: 'feePerKg',
        width: 120,
        render: (v: number) => (v != null ? <span className="font-semibold">{v}</span> : '—'),
      },
      {
        title: '挂号费',
        dataIndex: 'registrationFee',
        width: 100,
        render: (v: number) => (v != null ? <span className="font-semibold">{v}</span> : '—'),
      },
      {
        title: '首重费',
        dataIndex: 'firstWeightFee',
        width: 100,
        render: (v: number) => (v != null ? <span className="font-semibold">{v}</span> : '—'),
      },
      {
        title: '续重费/500g',
        dataIndex: 'additionalFeePer500g',
        width: 120,
        render: (v: number) => (v != null ? <span className="font-semibold">{v}</span> : '—'),
      },
      {
        title: '最低计费重',
        dataIndex: 'minChargeG',
        width: 100,
        render: (v: number) => `${v}g`,
      },
      {
        title: '体积重除数',
        dataIndex: 'volumeDivisor',
        width: 110,
        render: (v: number) => (v > 0 ? `${v}` : '不启用'),
      },
      {
        title: '币种',
        dataIndex: 'currency',
        width: 80,
      },
      {
        title: '档位标签',
        dataIndex: 'tierLabel',
        width: 140,
        ellipsis: true,
        render: (v: string) => v || '—',
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 140,
        render: (_v: unknown, r: ShippingRateRecord) => (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(r)}
              className="font-semibold text-foreground"
            >
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleDelete(r)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-[1.25] text-foreground">运费标准管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          查看、编辑或补充导入的渠道运费标准；调整后对所有定价计算即时生效。
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <CarbonField label="物流线路">
            <SearchableSelect
              value={filterLine}
              onValueChange={setFilterLine}
              options={[
                { value: '', label: '全部线路' },
                ...lines.map((l: ShippingLineOption) => ({
                  value: l.lineName,
                  label: l.lineName,
                  keywords: l.lineCategory,
                })),
              ]}
              searchPlaceholder="输入线路 / 分类检索"
            />
          </CarbonField>
          <CarbonField label="国家关键词">
            <Input
              className={carbonInputClass}
              placeholder="中文名 / 英文名 / 代码"
              value={filterCountry}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFilterCountry(e.target.value)
              }
            />
          </CarbonField>
          <CarbonField label="货型">
            <Select
              value={filterGoodsType}
              onValueChange={(v: string) =>
                setFilterGoodsType(v as '' | GoodsType)
              }
            >
              <SelectTrigger className={carbonSelectTriggerClass}>
                <SelectValue placeholder="全部货型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部货型</SelectItem>
                {GOODS_TYPES.map((t: GoodsType) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CarbonField>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setPage(1)}>查询</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-base font-semibold text-foreground">
            共 {total} 条记录
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadRateImportTemplate}>
              <FileDown className="mr-2 h-4 w-4" />
              下载导入模板
            </Button>
            <Button
              variant="outline"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? '导出中…' : '一键导出'}
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              新增运费标准
            </Button>
          </div>
        </div>
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500, y: 500 }}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p: number) => setPage(p),
          }}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑运费标准' : '新增运费标准'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3">
            <CarbonField label="物流线路 *">
              <SearchableSelect
                value={form.lineName}
                onValueChange={(v: string) =>
                  setForm((f) => ({ ...f, lineName: v }))
                }
                options={lines.map((l: ShippingLineOption) => ({
                  value: l.lineName,
                  label: l.lineName,
                  keywords: l.lineCategory,
                }))}
                placeholder="请选择或输入线路名"
                allowCustomValue
                searchPlaceholder="输入或自定义线路名"
              />
            </CarbonField>
            <CarbonField label="线路分类">
              <Input
                className={carbonInputClass}
                value={form.lineCategory}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, lineCategory: e.target.value }))
                }
                placeholder="如 经济类物流"
              />
            </CarbonField>
            <CarbonField label="货型">
              <Select
                value={form.goodsType}
                onValueChange={(v: string) =>
                  setForm((f) => ({ ...f, goodsType: v as GoodsType }))
                }
              >
                <SelectTrigger className={carbonSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOODS_TYPES.map((t: GoodsType) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CarbonField>
            <CarbonField label="国家中文名 *">
              <Input
                className={carbonInputClass}
                value={form.countryZh}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, countryZh: e.target.value }))
                }
                placeholder="如 美国"
              />
            </CarbonField>
            <CarbonField label="国家英文名 *">
              <Input
                className={carbonInputClass}
                value={form.countryEn}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, countryEn: e.target.value }))
                }
                placeholder="如 United States"
              />
            </CarbonField>
            <CarbonField label="国家代码 *">
              <Input
                className={carbonInputClass}
                value={form.countryCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, countryCode: e.target.value }))
                }
                placeholder="如 US"
              />
            </CarbonField>
            <CarbonField label="重量下限（g）*">
              <Input
                className={carbonInputClass}
                inputMode="numeric"
                value={form.weightMinG}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, weightMinG: e.target.value }))
                }
              />
            </CarbonField>
            <CarbonField label="重量上限（g）*">
              <Input
                className={carbonInputClass}
                inputMode="numeric"
                value={form.weightMaxG}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, weightMaxG: e.target.value }))
                }
              />
            </CarbonField>
            <CarbonField label="计费模式">
              <Select
                value={form.calcMode}
                onValueChange={(v: string) =>
                  setForm((f) => ({ ...f, calcMode: v as CalcMode }))
                }
              >
                <SelectTrigger className={carbonSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALC_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CarbonField>
            <CarbonField label="币种">
              <Select
                value={form.currency}
                onValueChange={(v: string) =>
                  setForm((f) => ({ ...f, currency: v }))
                }
              >
                <SelectTrigger className={carbonSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RMB">RMB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </CarbonField>
            <CarbonField label="单价（元/KG）">
              <Input
                className={carbonInputClass}
                inputMode="decimal"
                value={form.feePerKg}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, feePerKg: e.target.value }))
                }
              />
            </CarbonField>
            <CarbonField label="挂号费">
              <Input
                className={carbonInputClass}
                inputMode="decimal"
                value={form.registrationFee}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, registrationFee: e.target.value }))
                }
              />
            </CarbonField>
            <CarbonField label="最低计费重量（g）">
              <Input
                className={carbonInputClass}
                inputMode="numeric"
                value={form.minChargeG}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, minChargeG: e.target.value }))
                }
              />
            </CarbonField>
            <CarbonField label="首重费（0.5kg）">
              <Input
                className={carbonInputClass}
                inputMode="decimal"
                value={form.firstWeightFee}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, firstWeightFee: e.target.value }))
                }
              />
            </CarbonField>
            <CarbonField label="续重费/500g">
              <Input
                className={carbonInputClass}
                inputMode="decimal"
                value={form.additionalFeePer500g}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({
                    ...f,
                    additionalFeePer500g: e.target.value,
                  }))
                }
              />
            </CarbonField>
            <CarbonField label="档位标签">
              <Input
                className={carbonInputClass}
                value={form.tierLabel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, tierLabel: e.target.value }))
                }
                placeholder="如 0~150g(含)"
              />
            </CarbonField>
            <CarbonField label="体积重除数（cm³/g）">
              <Input
                className={carbonInputClass}
                inputMode="numeric"
                value={form.volumeDivisor}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, volumeDivisor: e.target.value }))
                }
                placeholder="默认 5000，填 0 不启用"
              />
            </CarbonField>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RatesPage;
