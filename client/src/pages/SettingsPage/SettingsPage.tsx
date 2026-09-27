import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { PricingSettings, UpdatePricingSettingsRequest } from '@shared/api.interface';
import { getSettings, updateSettings } from '@/api/pricing';
import { carbonInputClass } from '@/components/carbon-field';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/utils/format';

/** 非空且为 0~100（含）之间的数值 */
function isValidPercentInclusive(value: string): boolean {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100;
}

/** 非空且为 0~100（不含 100）之间的数值 */
function isValidPercentExclusive(value: string): boolean {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) && n >= 0 && n < 100;
}

/** 非空正数 */
function isValidPositive(value: string): boolean {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) && n > 0;
}

const settingsSchema = z.object({
  commissionRatePct: z.string().refine(isValidPercentInclusive, {
    message: '平台佣金率需为 0~100 之间的数值',
  }),
  exchangeRate: z.string().refine(isValidPositive, {
    message: '汇率需为正数',
  }),
  lossRatePct: z.string().refine(isValidPercentInclusive, {
    message: '损耗率需为 0~100 之间的数值',
  }),
  defaultProfitRatePct: z.string().refine(isValidPercentExclusive, {
    message: '默认利润率需为 0~100 之间的数值（不含 100）',
  }),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

/** 小数转百分数字符串（保留 2 位） */
function toPctString(value: number): string {
  return String(Number((value * 100).toFixed(2)));
}

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      commissionRatePct: '',
      exchangeRate: '',
      lossRatePct: '',
      defaultProfitRatePct: '',
    },
  });

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((s: PricingSettings) => {
        if (cancelled) return;
        form.reset({
          commissionRatePct: toPctString(s.commissionRate),
          exchangeRate: String(s.exchangeRate),
          lossRatePct: toPctString(s.lossRate),
          defaultProfitRatePct: toPctString(s.defaultProfitRate),
        });
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('读取定价参数失败', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form]);

  const onSubmit = form.handleSubmit((data: SettingsFormData): void => {
    const request: UpdatePricingSettingsRequest = {
      commissionRate: Number(data.commissionRatePct) / 100,
      exchangeRate: Number(data.exchangeRate),
      lossRate: Number(data.lossRatePct) / 100,
      defaultProfitRate: Number(data.defaultProfitRatePct) / 100,
    };
    setSaving(true);
    void updateSettings(request)
      .then(() => {
        toast.success('参数已保存，新的定价计算立即生效');
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('保存定价参数失败', error);
      })
      .finally(() => {
        setSaving(false);
      });
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <h2 className="text-[22px] font-semibold leading-[1.25] text-foreground">参数设置</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        平台佣金率、美元汇率、损耗率与默认利润率，调整并保存后对所有定价计算即时生效。
      </p>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <h3 className="text-base font-semibold">定价参数</h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">参数加载中…</p>
        ) : (
          <Form {...form}>
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-6">
              <div className="flex flex-wrap gap-6">
                <FormField
                  control={form.control}
                  name="commissionRatePct"
                  render={({ field }) => (
                    <FormItem className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">平台佣金率（%）</p>
                      <FormControl>
                        <Input
                          className={carbonInputClass}
                          inputMode="decimal"
                          placeholder="如 8"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        汇率（1 USD = X RMB）
                      </p>
                      <FormControl>
                        <Input
                          className={carbonInputClass}
                          inputMode="decimal"
                          placeholder="如 7.2"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-wrap gap-6">
                <FormField
                  control={form.control}
                  name="lossRatePct"
                  render={({ field }) => (
                    <FormItem className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">损耗率（%）</p>
                      <FormControl>
                        <Input
                          className={carbonInputClass}
                          inputMode="decimal"
                          placeholder="如 2"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultProfitRatePct"
                  render={({ field }) => (
                    <FormItem className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        默认目标利润率（%）
                      </p>
                      <FormControl>
                        <Input
                          className={carbonInputClass}
                          inputMode="decimal"
                          placeholder="如 30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? '保存中…' : '保存参数'}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
