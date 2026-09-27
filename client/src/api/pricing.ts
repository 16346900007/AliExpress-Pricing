import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { invoke } from '@tauri-apps/api/core';
import type {
  BatchCountriesRequest,
  BatchCountryResult,
  CompareLineResult,
  CompareLinesRequest,
  CountryOption,
  DiscountCalcRequest,
  DiscountCalcResult,
  FreightQuote,
  FreightQuoteRequest,
  PriceCalcRequest,
  PriceCalcResult,
  PricingSettings,
  ReverseCalcRequest,
  ReverseCalcResult,
  ShippingLineOption,
  UpdatePricingSettingsRequest,
} from '@shared/api.interface';

const PREFIX = '/api/pricing';

// 在 Tauri 中用 invoke，失败则 fallback 到 HTTP
async function callTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    // 不在 Tauri 环境，让调用方走 HTTP
    throw e;
  }
}

/** 物流线路列表 */
export async function getLines(): Promise<ShippingLineOption[]> {
  try { return await callTauri('get_lines'); } catch {}
  const res = await axiosForBackend.get<ShippingLineOption[]>(`${PREFIX}/lines`);
  return res.data;
}

/** 可选国家列表 */
export async function getCountries(lineName?: string): Promise<CountryOption[]> {
  try { return await callTauri('get_countries', { lineName: lineName || null }); } catch {}
  const res = await axiosForBackend.get<CountryOption[]>(`${PREFIX}/countries`, {
    params: lineName ? { lineName } : undefined,
  });
  return res.data;
}

/** 运费查询 */
export async function calcFreight(req: FreightQuoteRequest): Promise<FreightQuote | null> {
  try { return await callTauri('freight_quote', { dto: req }); } catch {}
  const res = await axiosForBackend.post<FreightQuote | null>(`${PREFIX}/freight`, req);
  return res.data;
}

/** 正向定价 */
export async function calcPrice(req: PriceCalcRequest): Promise<PriceCalcResult> {
  try { return await callTauri('price_calc', { dto: req }); } catch {}
  const res = await axiosForBackend.post<PriceCalcResult>(`${PREFIX}/price`, req);
  return res.data;
}

/** 反向验算 */
export async function calcReverse(req: ReverseCalcRequest): Promise<ReverseCalcResult> {
  try { return await callTauri('reverse_calc', { dto: req }); } catch {}
  const res = await axiosForBackend.post<ReverseCalcResult>(`${PREFIX}/reverse`, req);
  return res.data;
}

/** 折扣藏价 */
export async function calcDiscount(req: DiscountCalcRequest): Promise<DiscountCalcResult> {
  try { return await callTauri('discount_calc', { dto: req }); } catch {}
  const res = await axiosForBackend.post<DiscountCalcResult>(`${PREFIX}/discount`, req);
  return res.data;
}

/** 多国批量定价 */
export async function batchCountries(req: BatchCountriesRequest): Promise<BatchCountryResult[]> {
  try { return await callTauri('batch_countries', { dto: req }); } catch {}
  const res = await axiosForBackend.post<BatchCountryResult[]>(`${PREFIX}/batch-countries`, req);
  return res.data;
}

/** 多线路比价 */
export async function compareLines(req: CompareLinesRequest): Promise<CompareLineResult[]> {
  try { return await callTauri('compare_lines', { dto: req }); } catch {}
  const res = await axiosForBackend.post<CompareLineResult[]>(`${PREFIX}/compare-lines`, req);
  return res.data;
}

/** 读取参数 */
export async function getSettings(): Promise<PricingSettings> {
  try { return await callTauri('get_settings_cmd'); } catch {}
  const res = await axiosForBackend.get<PricingSettings>(`${PREFIX}/settings`);
  return res.data;
}

/** 更新参数 */
export async function updateSettings(req: UpdatePricingSettingsRequest): Promise<PricingSettings> {
  try { return await callTauri('update_settings_cmd', { dto: req }); } catch {}
  const res = await axiosForBackend.put<PricingSettings>(`${PREFIX}/settings`, req);
  return res.data;
}

// 运费标准列表走 Tauri
export async function listShippingRates(params: { page?: number; pageSize?: number }): Promise<unknown> {
  try {
    return await invoke('list_shipping_rates', { page: params.page, pageSize: params.pageSize });
  } catch {
    return { items: [], total: 0, page: 1, pageSize: 20 };
  }
}
export async function exportShippingRates(params: unknown): Promise<unknown> {
  const res = await axiosForBackend.get(`${PREFIX}/shipping-rates-export`, { params: params as any });
  return res.data;
}
export async function getShippingRate(id: string): Promise<unknown> {
  const res = await axiosForBackend.get(`${PREFIX}/shipping-rates/${id}`);
  return res.data;
}
export async function createShippingRate(req: unknown): Promise<unknown> {
  const res = await axiosForBackend.post(`${PREFIX}/shipping-rates`, req);
  return res.data;
}
export async function updateShippingRate(id: string, req: unknown): Promise<unknown> {
  const res = await axiosForBackend.put(`${PREFIX}/shipping-rates/${id}`, req);
  return res.data;
}
export async function deleteShippingRate(id: string): Promise<void> {
  await axiosForBackend.delete(`${PREFIX}/shipping-rates/${id}`);
}
