import { Fragment, useCallback, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  TemplatePreviewCell,
  TemplatePreviewCountry,
  TemplatePreviewResponse,
} from '@shared/api.interface';
import { previewTemplate } from '@/api/shipping-template';
import { carbonInputClass } from '@/components/carbon-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/utils/format';

const DEFAULT_WEIGHTS_TEXT = '50,100,200,500,1000';
const MAX_WEIGHTS = 8;

interface TemplatePreviewPanelProps {
  templateId: string;
  templateName: string;
  onBack: () => void;
}

/** 权重档文本 → 升序正整数数组；返回错误信息 */
function parseWeights(raw: string): { weights: number[]; error: string | null } {
  const parts = raw
    .split(/[,，]/u)
    .map((p: string) => p.trim())
    .filter((p: string) => p !== '');
  if (parts.length === 0) return { weights: [], error: '请至少填写一个重量档' };
  const weights: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/u.test(p) || Number(p) <= 0) {
      return { weights: [], error: `重量档「${p}」必须是正整数（单位克）` };
    }
    if (!weights.includes(Number(p))) weights.push(Number(p));
  }
  if (weights.length > MAX_WEIGHTS) {
    return { weights: [], error: `重量档最多 ${MAX_WEIGHTS} 个` };
  }
  weights.sort((a: number, b: number) => a - b);
  return { weights, error: null };
}

const CHARGE_MODE_LABEL: Record<string, string> = {
  standard: '标准运费',
  free: '免邮',
  discount: '减免运费',
};

/** CSV 字段转义：含逗号 / 引号 / 换行时加引号包裹 */
function csvEscape(value: string): string {
  return /[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

/** 运费模板对照表：国家 × 重量档的买家实付运费 + CSV 导出 */
const TemplatePreviewPanel = ({
  templateId,
  templateName,
  onBack,
}: TemplatePreviewPanelProps) => {
  const [weightsText, setWeightsText] = useState(DEFAULT_WEIGHTS_TEXT);
  const [result, setResult] = useState<TemplatePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async (): Promise<void> => {
    const { weights, error } = parseWeights(weightsText);
    if (error) {
      toast.error(error);
      return;
    }
    setLoading(true);
    try {
      const res = await previewTemplate(templateId, { weightsG: weights });
      setResult(res);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      logger.error('生成运费对照表失败', err);
    } finally {
      setLoading(false);
    }
  }, [templateId, weightsText]);

  /** 前端生成 UTF-8 BOM CSV 并触发下载 */
  const handleExportCsv = useCallback((): void => {
    if (!result) return;
    const header = [
      '组合线路',
      '货型',
      '计费方式',
      '国家',
      '国家代码',
      ...result.weightsG.map((w: number) => `${w}g买家运费`),
    ];
    const lines: string[] = [header.map(csvEscape).join(',')];
    for (const row of result.countries) {
      const cells: string[] = [
        row.lineName,
        row.goodsType,
        CHARGE_MODE_LABEL[row.chargeMode] ?? row.chargeMode,
        row.countryZh,
        row.countryCode,
      ];
      for (const cell of row.cells) {
        cells.push(cell.available ? cell.buyerFreightRmb.toFixed(2) : '');
      }
      lines.push(cells.map(csvEscape).join(','));
    }
    const csv = `\uFEFF${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName}-运费对照.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV 已导出');
  }, [result, templateName]);

  /** 单元格内容：免邮胶囊 / 减免金额 + 角标 / 金额 / 未覆盖灰字 */
  const renderCell = (row: TemplatePreviewCountry, cell: TemplatePreviewCell) => {
    if (!cell.available) {
      return <span className="text-[#9a9a95]">未覆盖</span>;
    }
    if (row.chargeMode === 'free') {
      return (
        <span className="inline-flex rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-medium text-[#1f8a4c]">
          免邮
        </span>
      );
    }
    const amount = `¥${cell.buyerFreightRmb.toFixed(2)}`;
    if (row.chargeMode === 'discount') {
      const pct = Math.round((row.discountPercent ?? 0) * 100);
      return (
        <span className="inline-flex items-center gap-1.5">
          <span>{amount}</span>
          <span className="inline-flex rounded-full bg-[#fff6d6] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[#9a7b12]">
            已减{pct}%
          </span>
        </span>
      );
    }
    return <span>{amount}</span>;
  };

  /** 按组合（线路 × 货型 × 计费方式）分块，保持返回顺序 */
  const grouped: { key: string; rows: TemplatePreviewCountry[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const row of result?.countries ?? []) {
    const key = `${row.lineName}|${row.goodsType}|${row.chargeMode}`;
    if (!groupIndex.has(key)) {
      groupIndex.set(key, grouped.length);
      grouped.push({ key, rows: [] });
    }
    grouped[groupIndex.get(key) as number].rows.push(row);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          返回模板列表
        </Button>
        <span className="text-sm text-muted-foreground">
          正在查看「{templateName}」的运费对照表
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-md">
            <label className="text-xs text-muted-foreground" htmlFor="weights-input">
              重量档（g，逗号分隔）
            </label>
            <Input
              id="weights-input"
              className={`${carbonInputClass} mt-2`}
              placeholder="如 50,100,200,500,1000"
              value={weightsText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWeightsText(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!result}
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" />
              导出 CSV
            </Button>
            <Button onClick={() => void handleGenerate()} disabled={loading}>
              {loading ? '生成中…' : '生成对照表'}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        {loading && <p className="text-sm text-muted-foreground">加载中…</p>}
        {!loading && !result && (
          <p className="text-sm text-muted-foreground">
            设置重量档后点击「生成对照表」，查看买家实付运费。
          </p>
        )}
        {!loading && result && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#fafaf9]">
                  <th className="whitespace-nowrap border-t border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    国家
                  </th>
                  {result.weightsG.map((w: number) => (
                    <th
                      key={w}
                      className="whitespace-nowrap border-t border-border px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {w}g
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="bg-[#fafaf9]">
                      <td
                        colSpan={result.weightsG.length + 1}
                        className="border-t border-border px-3 py-2"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {group.rows[0].lineName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {group.rows[0].goodsType}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              group.rows[0].chargeMode === 'free'
                                ? 'bg-[#e6f4ea] text-[#1f8a4c]'
                                : group.rows[0].chargeMode === 'discount'
                                  ? 'bg-[#fff6d6] text-[#9a7b12]'
                                  : 'bg-[#dcebff] text-[#2f66c9]'
                            }`}
                          >
                            {CHARGE_MODE_LABEL[group.rows[0].chargeMode]}
                          </Badge>
                        </span>
                      </td>
                    </tr>
                    {group.rows.map((row: TemplatePreviewCountry) => (
                      <tr key={`${group.key}-${row.countryCode}`} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className="text-foreground">{row.countryZh}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {row.countryCode}
                          </span>
                        </td>
                        {row.cells.map((cell: TemplatePreviewCell) => (
                          <td
                            key={`${row.countryCode}-${cell.weightG}`}
                            className="whitespace-nowrap px-3 py-2 text-right font-semibold"
                          >
                            {renderCell(row, cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatePreviewPanel;
