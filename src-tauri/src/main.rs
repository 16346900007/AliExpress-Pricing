// 速卖通定价系统 · Tauri 后端
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

// ---------- 数据结构 ----------

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PricingSettings {
    commission_rate: f64,
    exchange_rate: f64,
    loss_rate: f64,
    default_profit_rate: f64,
}

impl Default for PricingSettings {
    fn default() -> Self {
        Self { commission_rate: 0.08, exchange_rate: 7.2, loss_rate: 0.0, default_profit_rate: 0.2 }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ShippingLineOption { line_name: String, line_category: String }

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct CountryOption { country_code: String, country_zh: String, country_en: String }

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct FreightQuote {
    line_name: String, line_category: String, goods_type: String, country_zh: String,
    country_code: String, currency: String, tier_label: String, calc_mode: String,
    min_charge_g: i64, billable_weight_g: f64, volumetric_weight_g: f64,
    freight_original: f64, freight_rmb: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PriceCalcResult {
    freight_rmb: f64, total_cost_rmb: f64, break_even_price_usd: f64,
    suggested_price_usd: f64, expected_profit_rmb: f64,
    used_commission_rate: f64, used_loss_rate: f64, used_profit_rate: f64, used_exchange_rate: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ReverseCalcResult {
    freight_rmb: f64, total_cost_rmb: f64, revenue_rmb: f64, net_revenue_rmb: f64,
    profit_rmb: f64, profit_margin: f64, break_even_price_usd: f64,
    used_commission_rate: f64, used_loss_rate: f64, used_exchange_rate: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct DiscountCalcResult {
    freight_rmb: f64, total_cost_rmb: f64, min_sell_price_usd: f64,
    max_discount_rate: f64, min_discount_scale: f64, break_even_price_usd: f64,
    used_commission_rate: f64, used_loss_rate: f64, used_min_profit_rate: f64, used_exchange_rate: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct BatchCountryResult {
    country_code: String, country_zh: String, available: bool, freight_rmb: f64,
    tier_label: String, total_cost_rmb: f64, break_even_price_usd: f64,
    suggested_price_usd: f64, expected_profit_rmb: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    list_price_usd: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct CompareLineResult {
    line_name: String, line_category: String, available: bool, tier_label: String,
    freight_rmb: f64, total_cost_rmb: f64, break_even_price_usd: f64,
    suggested_price_usd: f64, expected_profit_rmb: f64, recommended: bool,
}

// ---------- DTO ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Dims {
    #[serde(default)] length_cm: Option<f64>,
    #[serde(default)] width_cm: Option<f64>,
    #[serde(default)] height_cm: Option<f64>,
}

impl Dims {
    fn triple(&self) -> Option<(f64, f64, f64)> {
        match (self.length_cm, self.width_cm, self.height_cm) {
            (Some(l), Some(w), Some(h)) => Some((l, w, h)),
            _ => None,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FreightQuoteDto {
    line_name: String, country_code: String, weight_g: f64,
    #[serde(default)] goods_type: Option<String>,
    #[serde(flatten)] dims: Dims,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PriceCalcDto {
    line_name: String, country_code: String, weight_g: f64, product_cost_rmb: f64,
    #[serde(default)] goods_type: Option<String>, #[serde(default)] profit_rate: Option<f64>,
    #[serde(flatten)] dims: Dims,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReverseCalcDto {
    line_name: String, country_code: String, weight_g: f64, product_cost_rmb: f64, selling_price_usd: f64,
    #[serde(default)] goods_type: Option<String>,
    #[serde(flatten)] dims: Dims,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscountCalcDto {
    line_name: String, country_code: String, weight_g: f64, product_cost_rmb: f64, list_price_usd: f64,
    #[serde(default)] goods_type: Option<String>, #[serde(default)] min_profit_rate: Option<f64>,
    #[serde(flatten)] dims: Dims,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchCountriesDto {
    line_name: String, country_codes: Vec<String>, weight_g: f64, product_cost_rmb: f64,
    #[serde(default)] goods_type: Option<String>, #[serde(default)] profit_rate: Option<f64>,
    #[serde(default)] discount_rate: Option<f64>,
    #[serde(flatten)] dims: Dims,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompareLinesDto {
    country_code: String, weight_g: f64, product_cost_rmb: f64,
    #[serde(default)] line_names: Option<Vec<String>>,
    #[serde(default)] goods_type: Option<String>, #[serde(default)] profit_rate: Option<f64>,
    #[serde(flatten)] dims: Dims,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSettingsDto {
    #[serde(default)] commission_rate: Option<f64>,
    #[serde(default)] exchange_rate: Option<f64>,
    #[serde(default)] loss_rate: Option<f64>,
    #[serde(default)] default_profit_rate: Option<f64>,
}

// ---------- 计算函数 ----------

fn round2(v: f64) -> f64 { (v * 100.0).round() / 100.0 }

fn volumetric_weight_g(dims: &Option<(f64, f64, f64)>, divisor: i64) -> Option<f64> {
    let (l, w, h) = dims.as_ref()?;
    if divisor <= 0 { return None; }
    Some(round2(l * w * h * 1000.0 / divisor as f64))
}

#[derive(Clone)]
struct RateRow {
    line_name: String, line_category: String, goods_type: String, country_zh: String,
    country_code: String, currency: String, min_charge_g: i64, calc_mode: String,
    fee_per_kg: Option<f64>, registration_fee: Option<f64>,
    first_weight_fee: Option<f64>, additional_fee_per_500g: Option<f64>,
    tier_label: Option<String>, volume_divisor: i64, weight_min_g: i64, weight_max_g: i64,
}

fn row_to_rate(row: &Row) -> Result<RateRow, rusqlite::Error> {
    Ok(RateRow {
        line_name: row.get("line_name")?, line_category: row.get("line_category")?,
        goods_type: row.get("goods_type")?, country_zh: row.get("country_zh")?,
        country_code: row.get("country_code")?, currency: row.get("currency")?,
        min_charge_g: row.get("min_charge_g")?, calc_mode: row.get("calc_mode")?,
        fee_per_kg: row.get("fee_per_kg")?, registration_fee: row.get("registration_fee")?,
        first_weight_fee: row.get("first_weight_fee")?, additional_fee_per_500g: row.get("additional_fee_per_500g")?,
        tier_label: row.get("tier_label")?, volume_divisor: row.get("volume_divisor")?,
        weight_min_g: row.get("weight_min_g")?,
        weight_max_g: row.get("weight_max_g")?,
    })
}

fn find_tier(conn: &Connection, line: &str, country: &str, goods: &str, weight: f64) -> Result<Option<RateRow>, String> {
    let mut stmt = conn.prepare(
        "SELECT * FROM ae_shipping_rate WHERE line_name=?1 AND country_code=?2 AND goods_type=?3 AND weight_min_g<=?4 AND weight_max_g>=?4 ORDER BY weight_min_g ASC, _created_at ASC LIMIT 1"
    ).map_err(|e| e.to_string())?;
    match stmt.query_row(params![line, country, goods, weight], row_to_rate) {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn build_freight_quote(row: &RateRow, weight_g: f64, exchange_rate: f64, dims: Option<(f64, f64, f64)>) -> FreightQuote {
    let (charge_g, vol_g) = match volumetric_weight_g(&dims, row.volume_divisor) {
        Some(vol) => (weight_g.max(vol), vol),
        None => (weight_g, 0.0),
    };
    let (billable_g, freight_orig) = if row.calc_mode == "first_additional" {
        let first = row.first_weight_fee.unwrap_or(0.0);
        let add = row.additional_fee_per_500g.unwrap_or(0.0);
        let steps = ((charge_g - 500.0).max(0.0) / 500.0).ceil();
        (charge_g, round2(first + steps * add))
    } else {
        let billable = charge_g.max(row.min_charge_g as f64);
        let fee = row.fee_per_kg.unwrap_or(0.0);
        let reg = row.registration_fee.unwrap_or(0.0);
        (billable, round2(fee * billable / 1000.0 + reg))
    };
    let freight_rmb = if row.currency == "USD" { round2(freight_orig * exchange_rate) } else { freight_orig };
    FreightQuote {
        line_name: row.line_name.clone(), line_category: row.line_category.clone(),
        goods_type: row.goods_type.clone(), country_zh: row.country_zh.clone(),
        country_code: row.country_code.clone(), currency: row.currency.clone(),
        tier_label: row.tier_label.clone().unwrap_or_default(), calc_mode: row.calc_mode.clone(),
        min_charge_g: row.min_charge_g, billable_weight_g: billable_g,
        volumetric_weight_g: vol_g, freight_original: freight_orig, freight_rmb,
    }
}

fn break_even(total_cost: f64, s: &PricingSettings) -> Result<f64, String> {
    let denom = 1.0 - s.commission_rate - s.loss_rate;
    if denom <= 0.0 { return Err("佣金/损耗率之和过高".into()); }
    Ok(round2(total_cost / s.exchange_rate / denom))
}

fn price_with_profit(total_cost: f64, s: &PricingSettings, profit: f64) -> Result<f64, String> {
    let denom = 1.0 - s.commission_rate - s.loss_rate - profit;
    if denom <= 0.0 { return Err("佣金/损耗/利润率之和过高".into()); }
    Ok(round2(total_cost / s.exchange_rate / denom))
}

fn expected_profit(suggested_usd: f64, total_cost: f64, s: &PricingSettings) -> f64 {
    let net = 1.0 - s.commission_rate - s.loss_rate;
    round2(suggested_usd * s.exchange_rate * net - total_cost)
}

// ---------- DB ----------

struct DbState { conn: Mutex<Connection> }

fn get_db_path() -> PathBuf {
    let app_data = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = app_data.join("ae-pricing");
    fs::create_dir_all(&dir).ok();
    dir.join("ae.db")
}

fn get_settings(conn: &Connection) -> Result<PricingSettings, String> {
    match conn.query_row(
        "SELECT commission_rate, exchange_rate, loss_rate, default_profit_rate FROM ae_pricing_setting LIMIT 1",
        [], |r| Ok(PricingSettings {
            commission_rate: r.get(0)?, exchange_rate: r.get(1)?,
            loss_rate: r.get(2)?, default_profit_rate: r.get(3)?,
        }),
    ) {
        Ok(s) => Ok(s),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let now = chrono::Utc::now().timestamp_millis();
            conn.execute(
                "INSERT INTO ae_pricing_setting (id, commission_rate, exchange_rate, loss_rate, default_profit_rate, _created_at, _updated_at) VALUES (?1, 0.08, 7.2, 0, 0.2, ?2, ?2)",
                params![uuid::Uuid::new_v4().to_string(), now],
            ).map_err(|e| e.to_string())?;
            Ok(PricingSettings::default())
        }
        Err(e) => Err(e.to_string()),
    }
}

fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS ae_shipping_rate (
            id TEXT PRIMARY KEY, line_name TEXT NOT NULL, line_category TEXT NOT NULL DEFAULT '经济类物流',
            goods_type TEXT NOT NULL DEFAULT '普货', country_zh TEXT NOT NULL, country_en TEXT NOT NULL,
            country_code TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'RMB',
            weight_min_g INTEGER NOT NULL DEFAULT 1, weight_max_g INTEGER NOT NULL,
            fee_per_kg REAL, registration_fee REAL, min_charge_g INTEGER NOT NULL DEFAULT 1,
            calc_mode TEXT NOT NULL DEFAULT 'per_gram', first_weight_fee REAL,
            additional_fee_per_500g REAL, tier_label TEXT, volume_divisor INTEGER NOT NULL DEFAULT 5000,
            _created_at INTEGER NOT NULL, _created_by TEXT, _updated_at INTEGER NOT NULL, _updated_by TEXT);
         CREATE INDEX IF NOT EXISTS idx_rate_lookup ON ae_shipping_rate(line_name, country_code, goods_type);
         CREATE TABLE IF NOT EXISTS ae_pricing_setting (
            id TEXT PRIMARY KEY, commission_rate REAL NOT NULL DEFAULT 0.08,
            exchange_rate REAL NOT NULL DEFAULT 7.2, loss_rate REAL NOT NULL DEFAULT 0,
            default_profit_rate REAL NOT NULL DEFAULT 0.2,
            _created_at INTEGER NOT NULL, _created_by TEXT, _updated_at INTEGER NOT NULL, _updated_by TEXT);
         CREATE TABLE IF NOT EXISTS ae_shipping_template (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, remark TEXT,
            group_list TEXT NOT NULL DEFAULT '[]',
            _created_at INTEGER NOT NULL, _created_by TEXT, _updated_at INTEGER NOT NULL, _updated_by TEXT);"
    ).map_err(|e| e.to_string())?;

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM ae_shipping_rate", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if count > 0 { return Ok(()); }

    // 种子数据直接编译进 exe
    let contents = include_str!("../../database/rates-seed.json");
    let rows: Vec<serde_json::Value> = serde_json::from_str(contents).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for row in &rows {
                tx.execute(
                    "INSERT INTO ae_shipping_rate (id,line_name,line_category,goods_type,country_zh,country_en,country_code,currency,weight_min_g,weight_max_g,fee_per_kg,registration_fee,min_charge_g,calc_mode,first_weight_fee,additional_fee_per_500g,tier_label,volume_divisor,_created_at,_updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?19)",
                    params![
                        uuid::Uuid::new_v4().to_string(),
                        row.get("line_name").and_then(|v| v.as_str()).unwrap_or(""),
                        row.get("line_category").and_then(|v| v.as_str()).unwrap_or("经济类物流"),
                        row.get("goods_type").and_then(|v| v.as_str()).unwrap_or("普货"),
                        row.get("country_zh").and_then(|v| v.as_str()).unwrap_or(""),
                        row.get("country_en").and_then(|v| v.as_str()).unwrap_or(""),
                        row.get("country_code").and_then(|v| v.as_str()).unwrap_or(""),
                        row.get("currency").and_then(|v| v.as_str()).unwrap_or("RMB"),
                        row.get("weight_min_g").and_then(|v| v.as_i64()).unwrap_or(1),
                        row.get("weight_max_g").and_then(|v| v.as_i64()).unwrap_or(1000),
                        row.get("fee_per_kg").and_then(|v| v.as_f64()),
                        row.get("registration_fee").and_then(|v| v.as_f64()),
                        row.get("min_charge_g").and_then(|v| v.as_i64()).unwrap_or(1),
                        row.get("calc_mode").and_then(|v| v.as_str()).unwrap_or("per_gram"),
                        row.get("first_weight_fee").and_then(|v| v.as_f64()),
                        row.get("additional_fee_per_500g").and_then(|v| v.as_f64()),
                        row.get("tier_label").and_then(|v| v.as_str()),
                        row.get("volume_divisor").and_then(|v| v.as_i64()).unwrap_or(5000),
                        now,
                    ],
                ).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    println!("[init] 已导入 {} 条运费数据", rows.len());
    Ok(())
}

// ---------- Tauri Commands ----------

type DbResult<T> = Result<T, String>;

#[tauri::command]
fn get_lines(state: State<DbState>) -> DbResult<Vec<ShippingLineOption>> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT DISTINCT line_name, line_category FROM ae_shipping_rate ORDER BY line_category, line_name").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(ShippingLineOption { line_name: r.get(0)?, line_category: r.get(1)? })).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_countries(state: State<DbState>, line_name: Option<String>) -> DbResult<Vec<CountryOption>> {
    let conn = state.conn.lock().unwrap();
    let (sql, params_vec): (&str, Vec<&dyn rusqlite::ToSql>) = match &line_name {
        Some(ln) => ("SELECT DISTINCT country_code, country_zh, country_en FROM ae_shipping_rate WHERE line_name=?1 ORDER BY country_zh", vec![ln]),
        None => ("SELECT DISTINCT country_code, country_zh, country_en FROM ae_shipping_rate ORDER BY country_zh", vec![]),
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params_vec.as_slice(), |r| Ok(CountryOption { country_code: r.get(0)?, country_zh: r.get(1)?, country_en: r.get(2)? })).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_settings_cmd(state: State<DbState>) -> DbResult<PricingSettings> {
    let conn = state.conn.lock().unwrap();
    get_settings(&conn)
}

#[tauri::command]
fn update_settings_cmd(state: State<DbState>, dto: UpdateSettingsDto) -> DbResult<PricingSettings> {
    let conn = state.conn.lock().unwrap();
    let current = get_settings(&conn)?;
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE ae_pricing_setting SET commission_rate=?1, exchange_rate=?2, loss_rate=?3, default_profit_rate=?4, _updated_at=?5",
        params![dto.commission_rate.unwrap_or(current.commission_rate), dto.exchange_rate.unwrap_or(current.exchange_rate),
                dto.loss_rate.unwrap_or(current.loss_rate), dto.default_profit_rate.unwrap_or(current.default_profit_rate), now],
    ).map_err(|e| e.to_string())?;
    get_settings(&conn)
}

#[tauri::command]
fn freight_quote(state: State<DbState>, dto: FreightQuoteDto) -> DbResult<FreightQuote> {
    let conn = state.conn.lock().unwrap();
    let s = get_settings(&conn)?;
    let goods = dto.goods_type.unwrap_or_else(|| "普货".into());
    let tier = find_tier(&conn, &dto.line_name, &dto.country_code, &goods, dto.weight_g)?.ok_or("该线路未覆盖此国家或重量")?;
    Ok(build_freight_quote(&tier, dto.weight_g, s.exchange_rate, dto.dims.triple()))
}

#[tauri::command]
fn price_calc(state: State<DbState>, dto: PriceCalcDto) -> DbResult<PriceCalcResult> {
    let conn = state.conn.lock().unwrap();
    let s = get_settings(&conn)?;
    let goods = dto.goods_type.unwrap_or_else(|| "普货".into());
    let tier = find_tier(&conn, &dto.line_name, &dto.country_code, &goods, dto.weight_g)?.ok_or("该线路未覆盖此国家或重量")?;
    let quote = build_freight_quote(&tier, dto.weight_g, s.exchange_rate, dto.dims.triple());
    let profit = dto.profit_rate.unwrap_or(s.default_profit_rate);
    let total = round2(dto.product_cost_rmb + quote.freight_rmb);
    let be = break_even(total, &s)?;
    let sug = price_with_profit(total, &s, profit)?;
    Ok(PriceCalcResult {
        freight_rmb: quote.freight_rmb, total_cost_rmb: total, break_even_price_usd: be,
        suggested_price_usd: sug, expected_profit_rmb: expected_profit(sug, total, &s),
        used_commission_rate: s.commission_rate, used_loss_rate: s.loss_rate,
        used_profit_rate: profit, used_exchange_rate: s.exchange_rate,
    })
}

#[tauri::command]
fn reverse_calc(state: State<DbState>, dto: ReverseCalcDto) -> DbResult<ReverseCalcResult> {
    if dto.selling_price_usd <= 0.0 { return Err("售价必须大于0".into()); }
    let conn = state.conn.lock().unwrap();
    let s = get_settings(&conn)?;
    let goods = dto.goods_type.unwrap_or_else(|| "普货".into());
    let tier = find_tier(&conn, &dto.line_name, &dto.country_code, &goods, dto.weight_g)?.ok_or("该线路未覆盖此国家或重量")?;
    let quote = build_freight_quote(&tier, dto.weight_g, s.exchange_rate, dto.dims.triple());
    let total = round2(dto.product_cost_rmb + quote.freight_rmb);
    let revenue = round2(dto.selling_price_usd * s.exchange_rate);
    let net_rate = 1.0 - s.commission_rate - s.loss_rate;
    let net_rev = round2(revenue * net_rate);
    let profit = round2(net_rev - total);
    Ok(ReverseCalcResult {
        freight_rmb: quote.freight_rmb, total_cost_rmb: total, revenue_rmb: revenue,
        net_revenue_rmb: net_rev, profit_rmb: profit, profit_margin: profit / revenue,
        break_even_price_usd: break_even(total, &s)?,
        used_commission_rate: s.commission_rate, used_loss_rate: s.loss_rate, used_exchange_rate: s.exchange_rate,
    })
}

#[tauri::command]
fn discount_calc(state: State<DbState>, dto: DiscountCalcDto) -> DbResult<DiscountCalcResult> {
    if dto.list_price_usd <= 0.0 { return Err("划线价必须大于0".into()); }
    let conn = state.conn.lock().unwrap();
    let s = get_settings(&conn)?;
    let goods = dto.goods_type.unwrap_or_else(|| "普货".into());
    let tier = find_tier(&conn, &dto.line_name, &dto.country_code, &goods, dto.weight_g)?.ok_or("该线路未覆盖此国家或重量")?;
    let quote = build_freight_quote(&tier, dto.weight_g, s.exchange_rate, dto.dims.triple());
    let min_profit = dto.min_profit_rate.unwrap_or(0.0);
    let total = round2(dto.product_cost_rmb + quote.freight_rmb);
    let min_sell = price_with_profit(total, &s, min_profit)?;
    Ok(DiscountCalcResult {
        freight_rmb: quote.freight_rmb, total_cost_rmb: total, min_sell_price_usd: min_sell,
        max_discount_rate: (1.0 - min_sell / dto.list_price_usd).max(0.0),
        min_discount_scale: min_sell / dto.list_price_usd,
        break_even_price_usd: break_even(total, &s)?,
        used_commission_rate: s.commission_rate, used_loss_rate: s.loss_rate,
        used_min_profit_rate: min_profit, used_exchange_rate: s.exchange_rate,
    })
}

#[tauri::command]
fn batch_countries(state: State<DbState>, dto: BatchCountriesDto) -> DbResult<Vec<BatchCountryResult>> {
    let conn = state.conn.lock().unwrap();
    let s = get_settings(&conn)?;
    let goods = dto.goods_type.unwrap_or_else(|| "普货".into());
    let profit = dto.profit_rate.unwrap_or(s.default_profit_rate);
    let discount = dto.discount_rate.unwrap_or(0.0);
    let mut results = Vec::new();
    for code in &dto.country_codes {
        match find_tier(&conn, &dto.line_name, code, &goods, dto.weight_g)? {
            Some(t) => {
                let quote = build_freight_quote(&t, dto.weight_g, s.exchange_rate, dto.dims.triple());
                let total = round2(dto.product_cost_rmb + quote.freight_rmb);
                let sug = price_with_profit(total, &s, profit)?;
                results.push(BatchCountryResult {
                    country_code: code.clone(), country_zh: t.country_zh, available: true,
                    freight_rmb: quote.freight_rmb, tier_label: quote.tier_label, total_cost_rmb: total,
                    break_even_price_usd: break_even(total, &s)?, suggested_price_usd: sug,
                    expected_profit_rmb: expected_profit(sug, total, &s),
                    list_price_usd: if discount > 0.0 { Some(round2(sug / (1.0 - discount))) } else { None },
                });
            }
            None => results.push(BatchCountryResult {
                country_code: code.clone(), country_zh: String::new(), available: false,
                freight_rmb: 0.0, tier_label: String::new(), total_cost_rmb: 0.0,
                break_even_price_usd: 0.0, suggested_price_usd: 0.0, expected_profit_rmb: 0.0, list_price_usd: None,
            }),
        }
    }
    Ok(results)
}

#[tauri::command]
fn compare_lines(state: State<DbState>, dto: CompareLinesDto) -> DbResult<Vec<CompareLineResult>> {
    let conn = state.conn.lock().unwrap();
    let s = get_settings(&conn)?;
    let goods = dto.goods_type.unwrap_or_else(|| "普货".into());
    let profit = dto.profit_rate.unwrap_or(s.default_profit_rate);
    let lines: Vec<String> = match &dto.line_names {
        Some(names) => names.clone(),
        None => {
            let mut stmt = conn.prepare("SELECT DISTINCT line_name FROM ae_shipping_rate ORDER BY line_name").map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        }
    };
    let mut results = Vec::new();
    for line in &lines {
        match find_tier(&conn, line, &dto.country_code, &goods, dto.weight_g)? {
            Some(t) => {
                let quote = build_freight_quote(&t, dto.weight_g, s.exchange_rate, dto.dims.triple());
                let total = round2(dto.product_cost_rmb + quote.freight_rmb);
                let sug = price_with_profit(total, &s, profit)?;
                results.push(CompareLineResult {
                    line_name: line.clone(), line_category: t.line_category, available: true,
                    tier_label: quote.tier_label, freight_rmb: quote.freight_rmb, total_cost_rmb: total,
                    break_even_price_usd: break_even(total, &s)?, suggested_price_usd: sug,
                    expected_profit_rmb: expected_profit(sug, total, &s), recommended: false,
                });
            }
            None => results.push(CompareLineResult {
                line_name: line.clone(), line_category: String::new(), available: false,
                tier_label: String::new(), freight_rmb: 0.0, total_cost_rmb: 0.0,
                break_even_price_usd: 0.0, suggested_price_usd: 0.0, expected_profit_rmb: 0.0, recommended: false,
            }),
        }
    }
    let mut best: Option<usize> = None;
    for (i, r) in results.iter().enumerate() {
        if r.available {
            match best { None => best = Some(i), Some(bi) if r.suggested_price_usd < results[bi].suggested_price_usd => best = Some(i), _ => {} }
        }
    }
    if let Some(bi) = best { results[bi].recommended = true; }
    Ok(results)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ShippingRateRecord {
    id: String, line_name: String, line_category: String, goods_type: String,
    country_zh: String, country_en: String, country_code: String, currency: String,
    weight_min_g: i64, weight_max_g: i64,
    fee_per_kg: Option<f64>, registration_fee: Option<f64>, min_charge_g: i64,
    calc_mode: String, first_weight_fee: Option<f64>, additional_fee_per_500g: Option<f64>,
    tier_label: Option<String>, volume_divisor: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ShippingRateListResult {
    items: Vec<ShippingRateRecord>,
    total: i64,
    page: i64,
    page_size: i64,
}

#[tauri::command]
fn list_shipping_rates(state: State<DbState>, page: Option<i64>, page_size: Option<i64>) -> DbResult<ShippingRateListResult> {
    let conn = state.conn.lock().unwrap();
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * page_size;
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM ae_shipping_rate", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, line_name, line_category, goods_type, country_zh, country_en, country_code, currency,
                weight_min_g, weight_max_g, fee_per_kg, registration_fee, min_charge_g,
                calc_mode, first_weight_fee, additional_fee_per_500g, tier_label, volume_divisor
         FROM ae_shipping_rate ORDER BY line_category, line_name, country_zh, weight_min_g LIMIT ?1 OFFSET ?2"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![page_size, offset], |r| {
        Ok(ShippingRateRecord {
            id: r.get(0)?, line_name: r.get(1)?, line_category: r.get(2)?, goods_type: r.get(3)?,
            country_zh: r.get(4)?, country_en: r.get(5)?, country_code: r.get(6)?, currency: r.get(7)?,
            weight_min_g: r.get(8)?, weight_max_g: r.get(9)?,
            fee_per_kg: r.get(10)?, registration_fee: r.get(11)?, min_charge_g: r.get(12)?,
            calc_mode: r.get(13)?, first_weight_fee: r.get(14)?, additional_fee_per_500g: r.get(15)?,
            tier_label: r.get(16)?, volume_divisor: r.get(17)?,
        })
    }).map_err(|e| e.to_string())?;
    let items = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(ShippingRateListResult { items, total, page, page_size })
}

// ---------- 模板相关类型 ----------

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct TemplateCountry { country_code: String, country_zh: String }

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct TemplateGroup {
    line_name: String, goods_type: String, charge_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    discount_percent: Option<f64>,
    countries: Vec<TemplateCountry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ShippingTemplateOut {
    id: String, name: String, #[serde(skip_serializing_if = "Option::is_none")] remark: Option<String>,
    groups: Vec<TemplateGroup>, updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct RecommendLineCountry {
    country_code: String, country_zh: String, freight_rmb: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct RecommendLineStat {
    line_name: String, line_category: String, country_count: i64,
    min_freight_rmb: f64, min_country_zh: String, min_country_code: String,
    median_freight_rmb: f64, max_freight_rmb: f64,
    countries: Vec<RecommendLineCountry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct RecommendLinesOut {
    goods_type: String, weight_g: f64, lines: Vec<RecommendLineStat>, used_exchange_rate: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecommendLinesDto {
    goods_type: String, weight_g: f64,
    #[serde(default)] line_names: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct RecommendCountryOut {
    country_code: String, country_zh: String, available: bool,
    line_name: String, line_category: String, freight_rmb: f64,
    tier_label: String, line_count: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct RecommendTemplateOut {
    goods_type: String, weight_g: f64,
    countries: Vec<RecommendCountryOut>, groups: Vec<TemplateGroup>, used_exchange_rate: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecommendTemplateDto {
    goods_type: String, weight_g: f64,
    #[serde(default)] country_codes: Vec<String>,
}

// 按线路推荐（不选国家）
#[tauri::command]
fn recommend_lines(state: State<DbState>, dto: RecommendLinesDto) -> DbResult<RecommendLinesOut> {
    let conn = state.conn.lock().unwrap();
    let settings = get_settings(&conn)?;
    let er = settings.exchange_rate;
    let mut stmt = conn.prepare(
        "SELECT line_name, line_category, goods_type, country_zh, country_code, currency,
                weight_min_g, weight_max_g, fee_per_kg, registration_fee, min_charge_g,
                calc_mode, first_weight_fee, additional_fee_per_500g, tier_label, volume_divisor
         FROM ae_shipping_rate WHERE goods_type = ?1 ORDER BY line_name, weight_min_g"
    ).map_err(|e| e.to_string())?;
    let rows_iter = stmt.query_map(params![dto.goods_type], |r| row_to_rate(r)).map_err(|e| e.to_string())?;
    let mut rows: Vec<RateRow> = rows_iter.filter_map(|x| x.ok()).collect();
    if let Some(names) = &dto.line_names {
        if !names.is_empty() { rows.retain(|r| names.contains(&r.line_name)); }
    }
    drop(stmt);

    use std::collections::BTreeMap;
    let mut by_line: BTreeMap<String, BTreeMap<String, (RateRow, f64)>> = BTreeMap::new();
    for row in &rows {
        if row.weight_min_g as f64 <= dto.weight_g && dto.weight_g <= row.weight_max_g as f64 {
            let q = build_freight_quote(row, dto.weight_g, er, None);
            let e = by_line.entry(row.line_name.clone()).or_insert_with(BTreeMap::new);
            if !e.contains_key(&row.country_code) {
                e.insert(row.country_code.clone(), (row.clone(), q.freight_rmb));
            }
        }
    }

    let mut lines = Vec::new();
    for (line_name, by_country) in by_line {
        if by_country.is_empty() { continue; }
        let mut freights: Vec<f64> = by_country.values().map(|(_, f)| *f).collect();
        freights.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mid = freights.len() / 2;
        let median = if freights.len() % 2 == 1 { freights[mid] } else { round2((freights[mid-1] + freights[mid]) / 2.0) };
        let max_f = freights[freights.len()-1];
        let cloned = by_country.clone();
        let (min_row, min_f) = cloned.values().min_by(|a, b| a.1.partial_cmp(&b.1).unwrap()).unwrap();
        let countries: Vec<RecommendLineCountry> = {
            let mut c: Vec<RecommendLineCountry> = by_country.into_iter().map(|(code, (row, f))| {
                RecommendLineCountry { country_code: code, country_zh: row.country_zh, freight_rmb: f }
            }).collect();
            c.sort_by(|a, b| a.freight_rmb.partial_cmp(&b.freight_rmb).unwrap());
            c
        };
        lines.push(RecommendLineStat {
            line_name, line_category: min_row.line_category.clone(),
            country_count: countries.len() as i64,
            min_freight_rmb: *min_f, min_country_zh: min_row.country_zh.clone(), min_country_code: min_row.country_code.clone(),
            median_freight_rmb: median, max_freight_rmb: max_f,
            countries,
        });
    }
    lines.sort_by(|a, b| a.median_freight_rmb.partial_cmp(&b.median_freight_rmb).unwrap());
    Ok(RecommendLinesOut { goods_type: dto.goods_type, weight_g: dto.weight_g, lines, used_exchange_rate: er })
}

// 按国家推荐
#[tauri::command]
fn recommend_template(state: State<DbState>, dto: RecommendTemplateDto) -> DbResult<RecommendTemplateOut> {
    let conn = state.conn.lock().unwrap();
    let settings = get_settings(&conn)?;
    let er = settings.exchange_rate;
    if dto.country_codes.is_empty() {
        return Ok(RecommendTemplateOut { goods_type: dto.goods_type, weight_g: dto.weight_g, countries: vec![], groups: vec![], used_exchange_rate: er });
    }
    let placeholders: Vec<String> = dto.country_codes.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "SELECT line_name, line_category, goods_type, country_zh, country_code, currency,
                weight_min_g, weight_max_g, fee_per_kg, registration_fee, min_charge_g,
                calc_mode, first_weight_fee, additional_fee_per_500g, tier_label, volume_divisor
         FROM ae_shipping_rate WHERE goods_type = ?1 AND country_code IN ({}) ORDER BY weight_min_g",
        placeholders.join(",")
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<Box<dyn rusqlite::ToSql>> = std::iter::once(Box::new(dto.goods_type.clone()) as Box<dyn rusqlite::ToSql>)
        .chain(dto.country_codes.iter().map(|c| Box::new(c.clone()) as Box<dyn rusqlite::ToSql>))
        .collect();
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|b| b.as_ref()).collect();
    let rows_iter = stmt.query_map(params_refs.as_slice(), |r| row_to_rate(r)).map_err(|e| e.to_string())?;
    let rows: Vec<RateRow> = rows_iter.filter_map(|x| x.ok()).collect();
    drop(stmt);

    use std::collections::BTreeMap;
    let mut zh_by_code: BTreeMap<String, String> = BTreeMap::new();
    for r in &rows { zh_by_code.insert(r.country_code.clone(), r.country_zh.clone()); }

    let mut hit_by_country: BTreeMap<String, Vec<(RateRow, f64)>> = BTreeMap::new();
    for row in &rows {
        if row.weight_min_g as f64 <= dto.weight_g && dto.weight_g <= row.weight_max_g as f64 {
            let q = build_freight_quote(row, dto.weight_g, er, None);
            hit_by_country.entry(row.country_code.clone()).or_insert_with(Vec::new).push((row.clone(), q.freight_rmb));
        }
    }

    let mut countries = Vec::new();
    let mut groups_by_line: BTreeMap<String, TemplateGroup> = BTreeMap::new();
    for code in &dto.country_codes {
        let zh = zh_by_code.get(code).cloned().unwrap_or_else(|| code.clone());
        match hit_by_country.get(code) {
            Some(hits) if !hits.is_empty() => {
                let best = hits.iter().min_by(|a, b| a.1.partial_cmp(&b.1).unwrap()).unwrap();
                let line_count: std::collections::BTreeSet<String> = hits.iter().map(|(r, _)| r.line_name.clone()).collect();
                countries.push(RecommendCountryOut {
                    country_code: code.clone(), country_zh: zh.clone(), available: true,
                    line_name: best.0.line_name.clone(), line_category: best.0.line_category.clone(),
                    freight_rmb: best.1, tier_label: best.0.tier_label.clone().unwrap_or_default(),
                    line_count: line_count.len() as i64,
                });
                let group = groups_by_line.entry(best.0.line_name.clone()).or_insert_with(|| TemplateGroup {
                    line_name: best.0.line_name.clone(), goods_type: dto.goods_type.clone(),
                    charge_mode: "standard".to_string(), discount_percent: None, countries: vec![],
                });
                group.countries.push(TemplateCountry { country_code: code.clone(), country_zh: zh });
            }
            _ => {
                countries.push(RecommendCountryOut {
                    country_code: code.clone(), country_zh: zh, available: false,
                    line_name: String::new(), line_category: String::new(), freight_rmb: 0.0,
                    tier_label: String::new(), line_count: 0,
                });
            }
        }
    }
    Ok(RecommendTemplateOut {
        goods_type: dto.goods_type, weight_g: dto.weight_g,
        countries, groups: groups_by_line.into_values().collect(), used_exchange_rate: er,
    })
}

// ---------- 模板 CRUD ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTemplateDto {
    name: String, #[serde(default)] remark: Option<String>,
    groups: Vec<TemplateGroup>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateTemplateDto {
    #[serde(default)] name: Option<String>, #[serde(default)] remark: Option<String>,
    #[serde(default)] groups: Option<Vec<TemplateGroup>>,
}

fn map_template_row(row: &rusqlite::Row) -> Result<ShippingTemplateOut, rusqlite::Error> {
    let id: String = row.get(0)?;
    let name: String = row.get(1)?;
    let remark: Option<String> = row.get(2)?;
    let group_json: String = row.get(3)?;
    let updated_at: i64 = row.get(4)?;
    let groups: Vec<TemplateGroup> = serde_json::from_str(&group_json).unwrap_or_default();
    Ok(ShippingTemplateOut {
        id, name, remark, groups,
        updated_at: chrono::DateTime::from_timestamp_millis(updated_at).unwrap_or_default().to_rfc3339(),
    })
}

#[tauri::command]
fn list_templates(state: State<DbState>) -> DbResult<Vec<ShippingTemplateOut>> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name, remark, group_list, _updated_at FROM ae_shipping_template ORDER BY _updated_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| map_template_row(r)).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|x| x.ok()).collect())
}

#[tauri::command]
fn get_template(state: State<DbState>, id: String) -> DbResult<ShippingTemplateOut> {
    let conn = state.conn.lock().unwrap();
    conn.query_row("SELECT id, name, remark, group_list, _updated_at FROM ae_shipping_template WHERE id = ?1", params![id], map_template_row).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_template(state: State<DbState>, dto: CreateTemplateDto) -> DbResult<ShippingTemplateOut> {
    let conn = state.conn.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let group_json = serde_json::to_string(&dto.groups).map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO ae_shipping_template (id, name, remark, group_list, _created_at, _updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, dto.name.trim(), dto.remark, group_json, now]).map_err(|e| e.to_string())?;
    conn.query_row("SELECT id, name, remark, group_list, _updated_at FROM ae_shipping_template WHERE id = ?1", params![id], map_template_row).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_template(state: State<DbState>, id: String, dto: UpdateTemplateDto) -> DbResult<ShippingTemplateOut> {
    let conn = state.conn.lock().unwrap();
    let now = chrono::Utc::now().timestamp_millis();
    if let Some(name) = &dto.name {
        conn.execute("UPDATE ae_shipping_template SET name = ?1, _updated_at = ?2 WHERE id = ?3", params![name.trim(), now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(remark) = &dto.remark {
        conn.execute("UPDATE ae_shipping_template SET remark = ?1, _updated_at = ?2 WHERE id = ?3", params![remark, now, id]).map_err(|e| e.to_string())?;
    }
    if let Some(groups) = &dto.groups {
        let group_json = serde_json::to_string(groups).map_err(|e| e.to_string())?;
        conn.execute("UPDATE ae_shipping_template SET group_list = ?1, _updated_at = ?2 WHERE id = ?3", params![group_json, now, id]).map_err(|e| e.to_string())?;
    }
    conn.query_row("SELECT id, name, remark, group_list, _updated_at FROM ae_shipping_template WHERE id = ?1", params![id], map_template_row).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_template(state: State<DbState>, id: String) -> DbResult<()> {
    let conn = state.conn.lock().unwrap();
    conn.execute("DELETE FROM ae_shipping_template WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PreviewCell {
    weight_g: f64, available: bool,
    standard_freight_rmb: f64, buyer_freight_rmb: f64, tier_label: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PreviewCountry {
    line_name: String, goods_type: String, charge_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")] discount_percent: Option<f64>,
    country_code: String, country_zh: String, cells: Vec<PreviewCell>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PreviewResult {
    template_id: String, template_name: String,
    weights_g: Vec<f64>, countries: Vec<PreviewCountry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewDto {
    weights_g: Vec<f64>,
}

#[tauri::command]
fn preview_template(state: State<DbState>, id: String, dto: PreviewDto) -> DbResult<PreviewResult> {
    let conn = state.conn.lock().unwrap();
    let settings = get_settings(&conn)?;
    let er = settings.exchange_rate;

    let (name, group_json): (String, String) = conn.query_row(
        "SELECT name, group_list FROM ae_shipping_template WHERE id = ?1",
        params![id], |r| Ok((r.get(0)?, r.get(1)?))
    ).map_err(|e| e.to_string())?;
    let groups: Vec<TemplateGroup> = serde_json::from_str(&group_json).unwrap_or_default();

    let mut weights = dto.weights_g.clone();
    weights.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let mut countries_out = Vec::new();
    for group in &groups {
        if group.countries.is_empty() { continue; }
        let codes: Vec<&str> = group.countries.iter().map(|c| c.country_code.as_str()).collect();
        let placeholders: Vec<String> = codes.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "SELECT line_name, line_category, goods_type, country_zh, country_code, currency,
                    weight_min_g, weight_max_g, fee_per_kg, registration_fee, min_charge_g,
                    calc_mode, first_weight_fee, additional_fee_per_500g, tier_label, volume_divisor
             FROM ae_shipping_rate WHERE line_name=?1 AND goods_type=?2 AND country_code IN ({}) ORDER BY weight_min_g",
            placeholders.join(",")
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let params: Vec<Box<dyn rusqlite::ToSql>> = std::iter::once(Box::new(group.line_name.clone()) as Box<dyn rusqlite::ToSql>)
            .chain(std::iter::once(Box::new(group.goods_type.clone()) as Box<dyn rusqlite::ToSql>))
            .chain(codes.iter().map(|c| Box::new(c.to_string()) as Box<dyn rusqlite::ToSql>))
            .collect();
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|b| b.as_ref()).collect();
        let rows_iter = stmt.query_map(params_refs.as_slice(), |r| row_to_rate(r)).map_err(|e| e.to_string())?;
        let rows: Vec<RateRow> = rows_iter.filter_map(|x| x.ok()).collect();
        drop(stmt);

        use std::collections::BTreeMap;
        let mut by_country: BTreeMap<String, Vec<RateRow>> = BTreeMap::new();
        for r in rows {
            by_country.entry(r.country_code.clone()).or_insert_with(Vec::new).push(r);
        }

        for country in &group.countries {
            let tiers = by_country.get(&country.country_code);
            let cells: Vec<PreviewCell> = weights.iter().map(|&w| {
                let hit = tiers.and_then(|ts| ts.iter().find(|r| r.weight_min_g as f64 <= w && w <= r.weight_max_g as f64));
                match hit {
                    None => PreviewCell { weight_g: w, available: false, standard_freight_rmb: 0.0, buyer_freight_rmb: 0.0, tier_label: String::new() },
                    Some(row) => {
                        let q = build_freight_quote(row, w, er, None);
                        let std_f = q.freight_rmb;
                        let buyer_f = match group.charge_mode.as_str() {
                            "free" => 0.0,
                            "discount" => round2(std_f * (1.0 - group.discount_percent.unwrap_or(0.0))),
                            _ => std_f,
                        };
                        PreviewCell { weight_g: w, available: true, standard_freight_rmb: std_f, buyer_freight_rmb: buyer_f, tier_label: q.tier_label }
                    }
                }
            }).collect();
            let zh = tiers.and_then(|ts| ts.first()).map(|r| r.country_zh.clone()).unwrap_or_else(|| country.country_zh.clone());
            countries_out.push(PreviewCountry {
                line_name: group.line_name.clone(), goods_type: group.goods_type.clone(),
                charge_mode: group.charge_mode.clone(), discount_percent: group.discount_percent,
                country_code: country.country_code.clone(), country_zh: zh, cells,
            });
        }
    }

    Ok(PreviewResult { template_id: id, template_name: name, weights_g: weights, countries: countries_out })
}

fn main() {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).expect("无法打开数据库");
    conn.execute_batch("PRAGMA journal_mode=WAL;").ok();
    init_db(&conn).expect("数据库初始化失败");

    tauri::Builder::default()
        .manage(DbState { conn: Mutex::new(conn) })
        .invoke_handler(tauri::generate_handler![
            get_lines, get_countries, get_settings_cmd, update_settings_cmd,
            freight_quote, price_calc, reverse_calc, discount_calc,
            batch_countries, compare_lines, list_shipping_rates,
            recommend_lines, recommend_template,
            list_templates, get_template, create_template, update_template, delete_template,
            preview_template,
        ])
        .run(tauri::generate_context!())
        .expect("启动失败");
}
