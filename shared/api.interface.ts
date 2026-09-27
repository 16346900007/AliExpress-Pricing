/* 前后端共享的类型写在这里 */

/** 定价参数（ae_pricing_setting 单行） */
export interface PricingSettings {
  /** 平台佣金率，小数（0.08 = 8%） */
  commissionRate: number;
  /** 汇率：1 USD = X RMB */
  exchangeRate: number;
  /** 损耗率，小数 */
  lossRate: number;
  /** 默认目标利润率（销售利润率口径），小数 */
  defaultProfitRate: number;
}

/** 更新定价参数（全部字段均可选，未提供的字段不更新） */
export interface UpdatePricingSettingsRequest {
  commissionRate?: number;
  exchangeRate?: number;
  lossRate?: number;
  defaultProfitRate?: number;
}

/** 物流线路选项 */
export interface ShippingLineOption {
  lineName: string;
  lineCategory: string;
}

/** 国家选项 */
export interface CountryOption {
  countryCode: string;
  countryZh: string;
  countryEn: string;
}

/** 货型：普货 | 非普货（含电） | 大包 */
export type GoodsType = '普货' | '非普货' | '大包';

/** 计费模式 */
export type CalcMode = 'per_gram' | 'first_additional';

/** 包裹尺寸（cm），三边齐全时启用体积重计费 */
export interface PackageDimensions {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

/** 运费标准记录（ae_shipping_rate 行） */
export interface ShippingRateRecord {
  id: string;
  lineName: string;
  lineCategory: string;
  goodsType: GoodsType;
  countryZh: string;
  countryEn: string;
  countryCode: string;
  currency: string;
  weightMinG: number;
  weightMaxG: number;
  feePerKg?: number;
  registrationFee?: number;
  minChargeG: number;
  calcMode: CalcMode;
  firstWeightFee?: number;
  additionalFeePer500g?: number;
  tierLabel?: string;
  /** 体积重除数（cm³/g）；5000 为行业默认，0 表示不启用体积重 */
  volumeDivisor?: number;
}

/** 运费标准列表查询参数 */
export interface ShippingRateListParams {
  page: number;
  pageSize: number;
  lineName?: string;
  countryKeyword?: string;
  goodsType?: GoodsType;
}

/** 运费标准分页响应 */
export interface ShippingRateListResponse {
  items: ShippingRateRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/** 运费标准导出参数（与列表筛选一致，不分页） */
export interface ShippingRateExportParams {
  lineName?: string;
  countryKeyword?: string;
  goodsType?: GoodsType;
}

/** 运费标准导出响应（全量，不分页） */
export interface ShippingRateExportResponse {
  items: ShippingRateRecord[];
}

/** 新建运费标准 */
export interface CreateShippingRateRequest {
  lineName: string;
  lineCategory?: string;
  goodsType: GoodsType;
  countryZh: string;
  countryEn: string;
  countryCode: string;
  currency?: string;
  weightMinG: number;
  weightMaxG: number;
  feePerKg?: number;
  registrationFee?: number;
  minChargeG?: number;
  calcMode: CalcMode;
  firstWeightFee?: number;
  additionalFeePer500g?: number;
  tierLabel?: string;
  /** 体积重除数（cm³/g）；默认 5000，0 表示不启用 */
  volumeDivisor?: number;
}

/** 更新运费标准（所有字段可选，仅更新提供的字段） */
export interface UpdateShippingRateRequest {
  lineName?: string;
  lineCategory?: string;
  goodsType?: GoodsType;
  countryZh?: string;
  countryEn?: string;
  countryCode?: string;
  currency?: string;
  weightMinG?: number;
  weightMaxG?: number;
  feePerKg?: number;
  registrationFee?: number;
  minChargeG?: number;
  calcMode?: CalcMode;
  firstWeightFee?: number;
  additionalFeePer500g?: number;
  tierLabel?: string;
  volumeDivisor?: number;
}

/** 单条运费报价明细 */
export interface FreightQuote {
  lineName: string;
  lineCategory: string;
  goodsType: string;
  countryZh: string;
  countryCode: string;
  /** 币种 RMB | USD（报价原币种） */
  currency: string;
  /** 重量档位原文，如 "0~150g(含)" */
  tierLabel: string;
  /** 计费模式 per_gram=按克计费；first_additional=首重续重 */
  calcMode: string;
  /** 最低计费重量（克） */
  minChargeG: number;
  /** 计费重量（克，含体积重取大后的值） */
  billableWeightG: number;
  /** 体积重（克）；未启用或未提供尺寸时为 0 */
  volumetricWeightG: number;
  /** 原币种运费 */
  freightOriginal: number;
  /** 折算成 RMB 的运费（按当前汇率） */
  freightRmb: number;
}

/** 运费查询请求 */
export interface FreightQuoteRequest extends PackageDimensions {
  lineName: string;
  countryCode: string;
  /** 包裹重量（克） */
  weightG: number;
  goodsType?: GoodsType;
}

/** 定价计算请求（正向定价 + 保本价） */
export interface PriceCalcRequest extends PackageDimensions {
  lineName: string;
  countryCode: string;
  /** 包裹重量（克） */
  weightG: number;
  /** 采购成本（RMB） */
  productCostRmb: number;
  goodsType?: GoodsType;
  /** 目标利润率，缺省用设置中的 defaultProfitRate */
  profitRate?: number;
}

/** 定价计算结果（正向定价 + 保本价共用） */
export interface PriceCalcResult {
  freightRmb: number;
  freight: FreightQuote | null;
  /** 成本合计 = 采购成本 + 运费（RMB） */
  totalCostRmb: number;
  /** 保本价（利润为0的最低售价，USD） */
  breakEvenPriceUsd: number;
  /** 建议售价（达成目标利润率的售价，USD） */
  suggestedPriceUsd: number;
  /** 建议售价下的预期利润（RMB） */
  expectedProfitRmb: number;
  usedCommissionRate: number;
  usedLossRate: number;
  usedProfitRate: number;
  usedExchangeRate: number;
}

/** 反向验算请求 */
export interface ReverseCalcRequest extends PackageDimensions {
  lineName: string;
  countryCode: string;
  weightG: number;
  productCostRmb: number;
  /** 实际售价（USD） */
  sellingPriceUsd: number;
  goodsType?: GoodsType;
}

/** 反向验算结果 */
export interface ReverseCalcResult {
  freightRmb: number;
  freight: FreightQuote | null;
  totalCostRmb: number;
  /** 销售收入（RMB） */
  revenueRmb: number;
  /** 扣除佣金与损耗后的净收入（RMB） */
  netRevenueRmb: number;
  /** 利润（RMB，可能为负） */
  profitRmb: number;
  /** 实际利润率（利润/销售收入），可能为负 */
  profitMargin: number;
  /** 保本价（USD） */
  breakEvenPriceUsd: number;
  usedCommissionRate: number;
  usedLossRate: number;
  usedExchangeRate: number;
}

/** 折扣藏价请求 */
export interface DiscountCalcRequest extends PackageDimensions {
  lineName: string;
  countryCode: string;
  weightG: number;
  productCostRmb: number;
  /** 划线价（USD） */
  listPriceUsd: number;
  goodsType?: GoodsType;
  /** 打折后仍要达到的最低利润率，缺省为 0（不亏即可） */
  minProfitRate?: number;
}

/** 折扣藏价结果 */
export interface DiscountCalcResult {
  freightRmb: number;
  totalCostRmb: number;
  /** 满足最低利润率的折后最低价（USD） */
  minSellPriceUsd: number;
  /** 最大可折扣比例（小数，0.35 = 最多降 35%） */
  maxDiscountRate: number;
  /** 折扣下限（"几折"，0.65 = 最低 6.5 折） */
  minDiscountScale: number;
  /** 保本价（USD，利润为 0） */
  breakEvenPriceUsd: number;
  usedCommissionRate: number;
  usedLossRate: number;
  usedMinProfitRate: number;
  usedExchangeRate: number;
}

/** 多国批量定价请求 */
export interface BatchCountriesRequest extends PackageDimensions {
  lineName: string;
  /** 目的国家列表 */
  countryCodes: string[];
  weightG: number;
  productCostRmb: number;
  goodsType?: GoodsType;
  profitRate?: number;
  /** 折扣率（0~0.99，如 0.3 表示计划打 7 折） */
  discountRate?: number;
}

/** 多国批量定价单国结果 */
export interface BatchCountryResult {
  countryCode: string;
  countryZh: string;
  /** 该线路是否覆盖此国家 */
  available: boolean;
  freightRmb: number;
  tierLabel: string;
  /** 成本合计（RMB） */
  totalCostRmb: number;
  /** 保本价（USD） */
  breakEvenPriceUsd: number;
  /** 建议售价（USD） */
  suggestedPriceUsd: number;
  /** 建议售价下的预期利润（RMB） */
  expectedProfitRmb: number;
  /** 建议划线标价（USD）；传入折扣率时 = 建议售价 / (1 - 折扣率)，折后到手价即建议售价；未传时缺省 */
  listPriceUsd?: number;
}

/** 多线路比价请求 */
export interface CompareLinesRequest extends PackageDimensions {
  countryCode: string;
  weightG: number;
  productCostRmb: number;
  goodsType?: GoodsType;
  profitRate?: number;
  /** 只比这些线路；缺省比全部线路 */
  lineNames?: string[];
}

// ---------- 运费模板 ----------

/** 模板计费方式：standard=标准运费；free=免邮（卖家包襄）；discount=自定义减免 */
export type TemplateChargeMode = 'standard' | 'free' | 'discount';

/** 模板内的国家引用 */
export interface TemplateCountryRef {
  countryCode: string;
  countryZh: string;
}

/** 模板目的地组合：一条线路 × 货型 × 一组国家 × 计费方式 */
export interface ShippingTemplateGroup {
  lineName: string;
  goodsType: GoodsType;
  chargeMode: TemplateChargeMode;
  /** chargeMode='discount' 时的减免比例（0.3 = 买家少付 30%），0~1 */
  discountPercent?: number;
  countries: TemplateCountryRef[];
}

/** 运费模板（对应速卖通后台「Create Daily Sales Template」的结构） */
export interface ShippingTemplate {
  id: string;
  name: string;
  remark?: string;
  groups: ShippingTemplateGroup[];
  updatedAt: string;
}

/** 新建运费模板 */
export interface CreateShippingTemplateRequest {
  name: string;
  remark?: string;
  groups: ShippingTemplateGroup[];
}

/** 更新运费模板（所有字段可选，仅更新提供的字段） */
export interface UpdateShippingTemplateRequest {
  name?: string;
  remark?: string;
  groups?: ShippingTemplateGroup[];
}

/** 模板对照表预览请求 */
export interface TemplatePreviewRequest {
  /** 参与对照的重量档（克），1~8 个，升序展示 */
  weightsG: number[];
}

/** 单国×单重量档的对照单元格 */
export interface TemplatePreviewCell {
  weightG: number;
  /** 线路是否覆盖该国家该重量档 */
  available: boolean;
  /** 标准运费（RMB，未应用模板计费方式） */
  standardFreightRmb: number;
  /** 买家实付运费（RMB）：free=0；discount=标准运费×(1-减免比例) */
  buyerFreightRmb: number;
  /** 命中重量档说明，如 "0~150g(含)"；未覆盖为空串 */
  tierLabel: string;
}

/** 预览结果中单国一行（按组合分组展开，同一国家可出现在多个组合） */
export interface TemplatePreviewCountry {
  lineName: string;
  goodsType: string;
  chargeMode: TemplateChargeMode;
  discountPercent?: number;
  countryCode: string;
  countryZh: string;
  cells: TemplatePreviewCell[];
}

/** 模板对照表预览响应 */
export interface TemplatePreviewResponse {
  templateId: string;
  templateName: string;
  weightsG: number[];
  countries: TemplatePreviewCountry[];
}

/** 模板推荐向导请求：按货型 + 重量 + 目的国家集合推荐运费最低的线路组合 */
export interface TemplateRecommendRequest {
  goodsType: GoodsType;
  /** 包裹重量（克） */
  weightG: number;
  /** 目的国家代码列表 */
  countryCodes: string[];
}

/** 向导单国推荐结果 */
export interface TemplateRecommendCountry {
  countryCode: string;
  countryZh: string;
  /** 是否有线路覆盖该国家该重量 */
  available: boolean;
  /** 运费最低的推荐线路；未覆盖为空串 */
  lineName: string;
  lineCategory: string;
  /** 推荐线路的标准运费（RMB） */
  freightRmb: number;
  /** 命中重量档说明，如 "0~150g(含)"；未覆盖为空串 */
  tierLabel: string;
  /** 覆盖该国家该重量的可选线路数 */
  lineCount: number;
}

/** 模板推荐向导响应 */
export interface TemplateRecommendResponse {
  goodsType: GoodsType;
  weightG: number;
  countries: TemplateRecommendCountry[];
  /** 可直接保存为模板的推荐分组（standard 计费，按推荐线路合并同线路国家） */
  groups: ShippingTemplateGroup[];
  usedExchangeRate: number;
}

/** 按线路推荐请求：不选国家，直接按货型 + 重量给出各线路代表运费 */
export interface RecommendLinesRequest {
  goodsType: GoodsType;
  /** 包裹重量（克） */
  weightG: number;
  /** 只看这些线路；缺省看全部 */
  lineNames?: string[];
}

/** 单条线路的代表运费统计 */
export interface RecommendLineStat {
  lineName: string;
  lineCategory: string;
  /** 该线路覆盖的国家数 */
  countryCount: number;
  /** 最低运费（RMB）及所在国家 */
  minFreightRmb: number;
  minCountryZh: string;
  minCountryCode: string;
  /** 各国运费中位数（RMB） */
  medianFreightRmb: number;
  /** 最高运费（RMB） */
  maxFreightRmb: number;
  /** 覆盖的全部国家及对应运费（RMB），按运费升序 */
  countries: { countryCode: string; countryZh: string; freightRmb: number }[];
}

/** 按线路推荐响应 */
export interface RecommendLinesResponse {
  goodsType: GoodsType;
  weightG: number;
  /** 按中位运费升序 */
  lines: RecommendLineStat[];
  usedExchangeRate: number;
}

/** 多线路比价单线路结果 */
export interface CompareLineResult {
  lineName: string;
  lineCategory: string;
  available: boolean;
  tierLabel: string;
  freightRmb: number;
  /** 成本合计（RMB） */
  totalCostRmb: number;
  /** 保本价（USD） */
  breakEvenPriceUsd: number;
  /** 建议售价（USD） */
  suggestedPriceUsd: number;
  /** 建议售价下的预期利润（RMB） */
  expectedProfitRmb: number;
  /** 是否运费最低的推荐线路 */
  recommended: boolean;
}
