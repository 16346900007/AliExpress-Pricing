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

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

async function tauriCall<T>(cmd: string, fallback: () => Promise<T>, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return invoke<T>(cmd, args);
  }
  return fallback();
}

async function httpGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function httpPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getLines(): Promise<ShippingLineOption[]> {
  return tauriCall('get_lines', () => httpGet('/api/pricing/lines'));
}

export async function getCountries(lineName?: string): Promise<CountryOption[]> {
  return tauriCall('get_countries', () => httpGet(`/api/pricing/countries${lineName ? `?lineName=${lineName}` : ''}`), { lineName: lineName || null });
}

export async function calcFreight(req: FreightQuoteRequest): Promise<FreightQuote | null> {
  return tauriCall('freight_quote', () => httpPost('/api/pricing/freight', req), { dto: req });
}

export async function calcPrice(req: PriceCalcRequest): Promise<PriceCalcResult> {
  return tauriCall('price_calc', () => httpPost('/api/pricing/price', req), { dto: req });
}

export async function calcReverse(req: ReverseCalcRequest): Promise<ReverseCalcResult> {
  return tauriCall('reverse_calc', () => Promise.reject(new Error('not implemented')), { dto: req });
}

export async function calcDiscount(req: DiscountCalcRequest): Promise<DiscountCalcResult> {
  return tauriCall('discount_calc', () => Promise.reject(new Error('not implemented')), { dto: req });
}

export async function batchCountries(req: BatchCountriesRequest): Promise<BatchCountryResult[]> {
  return tauriCall('batch_countries', () => Promise.reject(new Error('not implemented')), { dto: req });
}

export async function compareLines(req: CompareLinesRequest): Promise<CompareLineResult[]> {
  return tauriCall('compare_lines', () => Promise.reject(new Error('not implemented')), { dto: req });
}

export async function getSettings(): Promise<PricingSettings> {
  return tauriCall('get_settings_cmd', () => httpGet('/api/pricing/settings'));
}

export async function updateSettings(req: UpdatePricingSettingsRequest): Promise<PricingSettings> {
  return tauriCall('update_settings_cmd', () => Promise.reject(new Error('not implemented')), { dto: req });
}

export async function listShippingRates(params: { page?: number; pageSize?: number }): Promise<unknown> {
  const url = `/api/pricing/shipping-rates?page=${params.page || 1}&pageSize=${params.pageSize || 20}`;
  return tauriCall('list_shipping_rates', () => httpGet(url), { page: params.page, pageSize: params.pageSize });
}

export async function exportShippingRates(): Promise<unknown> {
  return {};
}

export async function getShippingRate(): Promise<unknown> { return null; }
export async function createShippingRate(): Promise<unknown> { return {}; }
export async function updateShippingRate(): Promise<unknown> { return {}; }
export async function deleteShippingRate(): Promise<void> {}
