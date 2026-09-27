import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import type { ShippingRateRecord } from '@shared/api.interface';

const RATE_COLUMNS: {
  header: string;
  get: (r: ShippingRateRecord) => string | number;
}[] = [
  { header: '物流线路', get: (r) => r.lineName },
  { header: '线路分类', get: (r) => r.lineCategory },
  { header: '货型', get: (r) => r.goodsType },
  { header: '国家中文名', get: (r) => r.countryZh },
  { header: '国家英文名', get: (r) => r.countryEn },
  { header: '国家代码', get: (r) => r.countryCode },
  { header: '重量下限（g）', get: (r) => r.weightMinG },
  { header: '重量上限（g）', get: (r) => r.weightMaxG },
  {
    header: '计费模式',
    get: (r) => (r.calcMode === 'per_gram' ? '按克计费' : '首重续重'),
  },
  { header: '单价（元/KG）', get: (r) => r.feePerKg ?? '' },
  { header: '挂号费', get: (r) => r.registrationFee ?? '' },
  { header: '首重费', get: (r) => r.firstWeightFee ?? '' },
  { header: '续重费（每500g）', get: (r) => r.additionalFeePer500g ?? '' },
  { header: '最低计费重（g）', get: (r) => r.minChargeG },
  { header: '体积重除数', get: (r) => r.volumeDivisor ?? 0 },
  { header: '币种', get: (r) => r.currency },
  { header: '档位标签', get: (r) => r.tierLabel ?? '' },
];

const TEMPLATE_HEADERS: string[] = RATE_COLUMNS.map((c) => c.header);

const TEMPLATE_EXAMPLE_ROWS: (string | number)[][] = [
  [
    '无忧物流-标准',
    '标准类物流',
    '普货',
    '美国',
    'United States',
    'US',
    1,
    2000,
    '按克计费',
    209.66,
    18.7,
    '',
    '',
    1,
    8000,
    'RMB',
    '0~2000g(含)',
  ],
  [
    '无忧物流-标准',
    '标准类物流',
    '大包',
    '美国',
    'United States',
    'US',
    2001,
    30000,
    '首重续重',
    '',
    '',
    413.82,
    170.83,
    1,
    8000,
    'RMB',
    '限重30kg',
  ],
];

const TEMPLATE_NOTES: string[][] = [
  ['字段', '是否必填', '填写说明'],
  ['物流线路', '必填', '线路名称，如：无忧物流-标准'],
  ['线路分类', '选填', '如：经济类物流 / 标准类物流'],
  ['货型', '必填', '可选：普货 / 非普货 / 大包'],
  ['国家中文名', '必填', '如：美国'],
  ['国家英文名', '必填', '如：United States'],
  ['国家代码', '必填', '两位国家代码，如：US'],
  ['重量下限（g）', '必填', '正整数'],
  ['重量上限（g）', '必填', '正整数，且 ≥ 下限；同一线路+国家+货型下各档位区间不可重叠'],
  ['计费模式', '必填', '可选：按克计费 / 首重续重'],
  ['单价（元/KG）', '按克计费必填', '每 KG 配送服务费'],
  ['挂号费', '选填', '每包裹挂号服务费'],
  ['首重费', '首重续重必填', '首重 0.5kg 的费用'],
  ['续重费（每500g）', '首重续重必填', '每 500g 续重费用'],
  ['最低计费重（g）', '选填', '低于该重量按该重量计费，默认 1'],
  ['体积重除数', '选填', '体积重 = 长×宽×高×1000/除数（g），计费重取实重与体积重的较大值；0 表示不启用'],
  ['币种', '选填', '可选：RMB / USD，默认 RMB'],
  ['档位标签', '选填', '档位展示名，如：0~2000g(含)'],
];

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string): void {
  const data = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** 导出运费标准为 xlsx（表头与导入模板一致） */
export function exportRatesXlsx(records: ShippingRateRecord[]): void {
  const headerRow: string[] = RATE_COLUMNS.map((c) => c.header);
  const rows: (string | number)[][] = records.map((r: ShippingRateRecord) =>
    RATE_COLUMNS.map((c) => c.get(r)),
  );
  const sheet = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '运费标准');
  const stamp = dayjs().format('YYYYMMDD_HHmm');
  downloadWorkbook(workbook, `运费标准导出_${stamp}.xlsx`);
}

/** 下载导入模板（含示例行与填写说明） */
export function downloadRateImportTemplate(): void {
  const sheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ...TEMPLATE_EXAMPLE_ROWS,
  ]);
  sheet['!cols'] = RATE_COLUMNS.map(() => ({ wch: 14 }));
  const notes = XLSX.utils.aoa_to_sheet(TEMPLATE_NOTES);
  notes['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 70 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '运费标准');
  XLSX.utils.book_append_sheet(workbook, notes, '填写说明');
  downloadWorkbook(workbook, '运费标准导入模板.xlsx');
}
