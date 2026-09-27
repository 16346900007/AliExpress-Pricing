/** 金额与百分比展示 / 输入解析工具（Carbon 定价系统共用） */

export function fmtUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function fmtRmb(value: number): string {
  return `¥${value.toFixed(2)}`;
}

/** 小数 → 百分比展示（0.08 → "8.00%"） */
export function fmtPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** 解析必须大于 0 的数字输入 */
export function parsePositiveNumber(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`请输入有效的${label}（需大于 0）`);
  }
  return n;
}

/** 解析允许为 0 的数字输入 */
export function parseNonNegativeNumber(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`请输入有效的${label}（不能为负数）`);
  }
  return n;
}

/** 百分比输入 → 小数（"8" → 0.08），要求 0 ≤ 值 < 100 */
export function parsePercentInput(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n >= 100) {
    throw new Error(`${label}需为 0~100 之间的百分比数值`);
  }
  return n / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 从 axios / Error / unknown 中提取可读错误信息 */
export function getErrorMessage(error: unknown): string {
  if (isRecord(error) && isRecord(error.response) && isRecord(error.response.data)) {
    const msg = error.response.data.message;
    if (typeof msg === 'string' && msg) return msg;
    if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
  }
  if (error instanceof Error && error.message) return error.message;
  return '请求失败，请稍后重试';
}
