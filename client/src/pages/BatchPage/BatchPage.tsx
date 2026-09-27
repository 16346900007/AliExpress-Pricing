import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ShippingLineOption } from '@shared/api.interface';
import { getLines } from '@/api/pricing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getErrorMessage } from '@/utils/format';
import BatchCountriesTab from './BatchCountriesTab';
import CompareLinesTab from './CompareLinesTab';

const BatchPage = () => {
  const [lines, setLines] = useState<ShippingLineOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    getLines()
      .then((list: ShippingLineOption[]) => {
        if (!cancelled) setLines(list);
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
        logger.error('加载物流线路失败', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <h2 className="text-[22px] font-semibold leading-[1.25] text-foreground">批量定价</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        一次录入商品成本与重量，批量计算多个国家的售价与利润，并对比不同物流线路的优劣。
      </p>

      <Tabs defaultValue="countries">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="countries">多国批量定价</TabsTrigger>
          <TabsTrigger value="compare">多线路比价</TabsTrigger>
        </TabsList>
        <TabsContent value="countries" className="mt-6">
          <BatchCountriesTab lines={lines} />
        </TabsContent>
        <TabsContent value="compare" className="mt-6">
          <CompareLinesTab lines={lines} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BatchPage;
