import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Eye, PencilLine, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ShippingLineOption, ShippingTemplate } from '@shared/api.interface';
import { getLines } from '@/api/pricing';
import { deleteTemplate, listTemplates } from '@/api/shipping-template';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getErrorMessage } from '@/utils/format';
import TemplateEditorDialog from './TemplateEditorDialog';
import TemplatePreviewPanel from './TemplatePreviewPanel';

/** 模板列表页：运费模板的增删改查 + 对照表入口 */
const TemplatesPage = () => {
  const [lines, setLines] = useState<ShippingLineOption[]>([]);
  const [templates, setTemplates] = useState<ShippingTemplate[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingTemplate | null>(null);
  const [viewTemplate, setViewTemplate] = useState<ShippingTemplate | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ShippingTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async (): Promise<void> => {
    setListLoading(true);
    try {
      const list = await listTemplates();
      setTemplates(list);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('加载运费模板列表失败', error);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  // 线路列表只加载一次（编辑弹窗共用）
  useEffect(() => {
    let cancelled = false;
    getLines()
      .then((data: ShippingLineOption[]) => {
        if (!cancelled) setLines(data);
      })
      .catch((error: unknown) => logger.error('加载线路列表失败', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = (): void => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (t: ShippingTemplate): void => {
    setEditing(t);
    setEditorOpen(true);
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      toast.success('模板已删除');
      setDeleteTarget(null);
      if (viewTemplate?.id === deleteTarget.id) setViewTemplate(null);
      void fetchTemplates();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      logger.error('删除运费模板失败', error);
    } finally {
      setDeleting(false);
    }
  };

  /** 按 groups 去重的覆盖国家数 */
  const countryCount = (t: ShippingTemplate): number => {
    const codes = new Set<string>();
    for (const g of t.groups) {
      for (const c of g.countries) codes.add(c.countryCode);
    }
    return codes.size;
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-[1.25] text-foreground">运费模板</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          把店铺运费模板的结构录进来，生成国家 × 重量的买家运费对照表
        </p>
      </div>

      {viewTemplate ? (
        <TemplatePreviewPanel
          templateId={viewTemplate.id}
          templateName={viewTemplate.name}
          onBack={() => setViewTemplate(null)}
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              新建模板
            </Button>
          </div>

          {listLoading && (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-xs">
              加载中…
            </div>
          )}

          {!listLoading && templates.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-xs">
              还没有运费模板，点击右上角新建
            </div>
          )}

          <div className="space-y-4">
            {!listLoading &&
              templates.map((t: ShippingTemplate) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground">{t.name}</p>
                      {t.remark && (
                        <p className="mt-1 text-sm text-muted-foreground">{t.remark}</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t.groups.length} 个组合 · 覆盖 {countryCount(t)} 国 · 更新于{' '}
                        {dayjs(t.updatedAt).format('YYYY-MM-DD HH:mm')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(t)}
                      >
                        <PencilLine className="h-4 w-4" />
                        编辑
                      </Button>
                      <Button size="sm" onClick={() => setViewTemplate(t)}>
                        <Eye className="h-4 w-4" />
                        查看对照
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      <TemplateEditorDialog
        open={editorOpen}
        template={editing}
        lines={lines}
        onOpenChange={setEditorOpen}
        onSaved={() => void fetchTemplates()}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除模板</DialogTitle>
            <DialogDescription>
              将删除「{deleteTarget?.name}」及其全部目的地组合，删除后不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? '删除中…' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplatesPage;
