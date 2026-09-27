import { invoke } from '@tauri-apps/api/core';
import type {
  CreateShippingTemplateRequest,
  RecommendLinesRequest,
  RecommendLinesResponse,
  ShippingTemplate,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TemplateRecommendRequest,
  TemplateRecommendResponse,
  UpdateShippingTemplateRequest,
} from '@shared/api.interface';

async function tauriCall<T>(cmd: string, fallback: T, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch {
    return fallback;
  }
}

export async function listTemplates(): Promise<ShippingTemplate[]> {
  return tauriCall('list_templates', [] as ShippingTemplate[]);
}

export async function getTemplate(id: string): Promise<ShippingTemplate> {
  return tauriCall('get_template', {} as ShippingTemplate, { id });
}

export async function createTemplate(req: CreateShippingTemplateRequest): Promise<ShippingTemplate> {
  return tauriCall('create_template', {} as ShippingTemplate, { dto: req });
}

export async function updateTemplate(id: string, req: UpdateShippingTemplateRequest): Promise<ShippingTemplate> {
  return tauriCall('update_template', {} as ShippingTemplate, { id, dto: req });
}

export async function deleteTemplate(id: string): Promise<void> {
  try { await invoke('delete_template', { id }); } catch {}
}

export async function recommendTemplate(req: TemplateRecommendRequest): Promise<TemplateRecommendResponse> {
  return tauriCall('recommend_template', { results: [] } as TemplateRecommendResponse, { dto: req });
}

export async function recommendLines(req: RecommendLinesRequest): Promise<RecommendLinesResponse> {
  return tauriCall('recommend_lines', { lines: [] } as RecommendLinesResponse, { dto: req });
}

export async function previewTemplate(id: string, req: TemplatePreviewRequest): Promise<TemplatePreviewResponse> {
  return tauriCall('preview_template', { countries: [], weightsG: [], templateId: '', templateName: '' } as TemplatePreviewResponse, { id, dto: req });
}
