import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RecommendLineStat, RecommendLinesResponse } from '@shared/api.interface';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

interface RecommendLinesPanelProps {
  result: RecommendLinesResponse;
  /** lineName → 已勾选的国家代码（缺省表示未勾选） */
  selection: Record<string, string[]>;
  onToggleLine: (line: RecommendLineStat) => void;
  onToggleCountry: (line: RecommendLineStat, countryCode: string) => void;
}

function formatRmb(value: number): string {
  return `¥${value.toFixed(2)}`;
}

/** 向导第②步（按线路模式）：线路列表 + 价格区间筛选，展开可按国家勾选 */
const RecommendLinesPanel = ({
  result,
  selection,
  onToggleLine,
  onToggleCountry,
}: RecommendLinesPanelProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const min = priceMin.trim() === '' ? -Infinity : Number(priceMin);
  const max = priceMax.trim() === '' ? Infinity : Number(priceMax);
  const validRange =
    (priceMin.trim() === '' || !Number.isNaN(min)) &&
    (priceMax.trim() === '' || !Number.isNaN(max)) &&
    min <= max;

  const filtered = validRange
    ? result.lines
        .map((l: RecommendLineStat) => ({
          line: l,
          hitCountries: l.countries.filter(
            (c) => c.freightRmb >= min && c.freightRmb <= max
          ),
        }))
        .filter((item) => item.hitCountries.length > 0)
        .map((item) => ({
          ...item.line,
          countries: item.hitCountries,
          countryCount: item.hitCountries.length,
          minFreightRmb: item.hitCountries[0].freightRmb,
          minCountryZh: item.hitCountries[0].countryZh,
          minCountryCode: item.hitCountries[0].countryCode,
          maxFreightRmb:
            item.hitCountries[item.hitCountries.length - 1].freightRmb,
          medianFreightRmb: item.hitCountries.length > 0
            ? (() => {
                const freights = item.hitCountries.map(
                  (c) => c.freightRmb
                );
                const mid = Math.floor(freights.length / 2);
                return freights.length % 2 === 1
                  ? freights[mid]
                  : Math.round(((freights[mid - 1] + freights[mid]) / 2) * 100) / 100;
              })()
            : 0,
        }))
        .sort(
          (a, b) =>
            a.minFreightRmb === b.minFreightRmb
              ? a.lineName.localeCompare(b.lineName)
              : a.minFreightRmb - b.minFreightRmb
        )
    : result.lines;

  const toggleExpand = (lineName: string): void => {
    setExpanded((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(lineName)) next.delete(lineName);
      else next.add(lineName);
      return next;
    });
  };

  const selectedLineCount = filtered.filter(
    (l: RecommendLineStat) => (selection[l.lineName] ?? []).length > 0
  ).length;

  const allExpanded = filtered.every((l: RecommendLineStat) =>
    expanded.has(l.lineName)
  );
  const toggleAllExpand = (): void => {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(filtered.map((l: RecommendLineStat) => l.lineName)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          按最低运费排序 · 共 {filtered.length} 条线路
          {selectedLineCount > 0 && <> · 已选 {selectedLineCount} 条</>}
          {validRange && (priceMin || priceMax) && (
            <>
              {' '}· 命中{' '}
              {filtered.reduce(
                (sum: number, l) => sum + l.countries.length,
                0
              )}{' '}
              个国家
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              国家运费区间（¥）
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-24"
                placeholder="最低"
                value={priceMin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPriceMin(e.target.value)
                }
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="number"
                className="w-24"
                placeholder="最高"
                value={priceMax}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPriceMax(e.target.value)
                }
              />
            </div>
            {!validRange && (
              <p className="text-[11px] text-amber-700">区间有误</p>
            )}
          </div>
          <button
            type="button"
            onClick={toggleAllExpand}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {allExpanded ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                全部收起
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                全部展开
              </>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-3 py-2.5 text-left font-medium" />
              <th className="w-8 px-1 py-2.5 font-medium" />
              <th className="px-4 py-2.5 text-left font-medium">线路</th>
              <th className="px-4 py-2.5 text-left font-medium">分类</th>
              <th className="px-4 py-2.5 text-right font-medium">覆盖国家</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  没有符合该价格区间的线路
                </td>
              </tr>
            ) : (
              filtered.map((line: RecommendLineStat, idx: number) => {
                const isOpen = expanded.has(line.lineName);
                const picked = selection[line.lineName] ?? [];
                const allSelected = picked.length === line.countries.length;
                const someSelected = picked.length > 0 && !allSelected;
                return (
                  <Fragment key={line.lineName}>
                    <tr
                      className="cursor-pointer border-t border-border/60 hover:bg-muted/30"
                      onClick={() => onToggleLine(line)}
                    >
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={
                            allSelected
                              ? true
                              : someSelected
                                ? 'indeterminate'
                                : false
                          }
                          className="pointer-events-none"
                        />
                      </td>
                      <td className="px-1 py-2.5">
                        <button
                          type="button"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            toggleExpand(line.lineName);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={isOpen ? '收起国家' : '展开国家'}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {line.lineName}
                        {idx < 3 && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            低运费
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {line.lineCategory}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {line.countryCount}
                        {picked.length > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (选 {picked.length})
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td colSpan={5} className="px-4 py-3 pl-12">
                          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {line.countries.map((c) => {
                              const countryPicked = picked.includes(
                                c.countryCode
                              );
                              return (
                                <button
                                  key={c.countryCode}
                                  type="button"
                                  onClick={() =>
                                    onToggleCountry(line, c.countryCode)
                                  }
                                  className={`flex items-center justify-between rounded-md border px-3 py-1.5 transition-colors ${
                                    countryPicked
                                      ? 'border-foreground/20 bg-primary/5'
                                      : 'border-border bg-card hover:bg-muted/50'
                                  }`}
                                >
                                  <span className="flex items-center gap-2 truncate text-foreground">
                                    <Checkbox
                                      checked={countryPicked}
                                      className="pointer-events-none"
                                    />
                                    {c.countryZh}
                                  </span>
                                  <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                                    {formatRmb(c.freightRmb)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        点击整行 = 全选/清空该线路在当前筛选下的命中国家；展开后点击国家可单独勾选
      </p>
    </div>
  );
};

export default RecommendLinesPanel;
