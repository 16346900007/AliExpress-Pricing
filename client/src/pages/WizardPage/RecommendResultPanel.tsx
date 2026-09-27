import type {
  TemplateRecommendCountry,
  TemplateRecommendResponse,
} from '@shared/api.interface';

interface RecommendResultPanelProps {
  result: TemplateRecommendResponse;
}

function formatRmb(value: number): string {
  return `¥${value.toFixed(2)}`;
}

/** 向导第②步：推荐结果表（每国运费最低线路）+ 线路分组汇总 */
const RecommendResultPanel = ({ result }: RecommendResultPanelProps) => {
  const covered = result.countries.filter(
    (c: TemplateRecommendCountry) => c.available
  );
  const uncovered = result.countries.filter(
    (c: TemplateRecommendCountry) => !c.available
  );
  const freights = covered.map((c: TemplateRecommendCountry) => c.freightRmb);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            覆盖国家
          </p>
          <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums">
            {covered.length}
            <span className="text-sm font-normal text-muted-foreground">
              / {result.countries.length}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            推荐线路分组
          </p>
          <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums">
            {result.groups.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            最低运费
          </p>
          <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-emerald-600">
            {covered.length > 0 ? formatRmb(Math.min(...freights)) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            最高运费
          </p>
          <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-amber-600">
            {covered.length > 0 ? formatRmb(Math.max(...freights)) : '—'}
          </p>
        </div>
      </div>

      {uncovered.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          {uncovered.length} 个国家在「{result.goodsType}」货型 {result.weightG}g
          下无线路覆盖：{uncovered.map((c) => c.countryZh).join('、')}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">国家</th>
              <th className="px-4 py-2.5 text-left font-medium">推荐线路</th>
              <th className="px-4 py-2.5 text-left font-medium">分类</th>
              <th className="px-4 py-2.5 text-left font-medium">命中档位</th>
              <th className="px-4 py-2.5 text-right font-medium">标准运费</th>
              <th className="px-4 py-2.5 text-right font-medium">可选线路</th>
            </tr>
          </thead>
          <tbody>
            {result.countries.map((c: TemplateRecommendCountry) => (
              <tr
                key={c.countryCode}
                className="border-t border-border/60 hover:bg-muted/30"
              >
                <td className="whitespace-nowrap px-4 py-2.5">
                  {c.countryZh}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {c.countryCode}
                  </span>
                </td>
                {c.available ? (
                  <>
                    <td className="px-4 py-2.5 font-medium">{c.lineName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {c.lineCategory}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {c.tierLabel}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatRmb(c.freightRmb)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {c.lineCount}
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="px-4 py-2.5 text-muted-foreground">
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                      未覆盖
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          推荐分组（同线路国家合并）
        </p>
        {result.groups.map((g) => (
          <div
            key={g.lineName}
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <p className="text-sm font-medium">{g.lineName}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {g.goodsType} · {g.countries.map((c) => c.countryZh).join('、')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendResultPanel;
