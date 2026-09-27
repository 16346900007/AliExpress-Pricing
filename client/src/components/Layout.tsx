import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Layers,
  SlidersHorizontal,
  Sparkles,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/calculator', label: '定价计算器', icon: Calculator },
  { to: '/batch', label: '批量定价', icon: Layers },
  { to: '/rates', label: '运费标准', icon: Warehouse },
  { to: '/templates', label: '运费模板', icon: ClipboardList },
  { to: '/wizard', label: '模板推荐', icon: Sparkles },
  { to: '/settings', label: '参数设置', icon: SlidersHorizontal },
];

const PAGE_TITLES: Record<string, string> = {
  '/calculator': '定价计算器',
  '/batch': '批量定价',
  '/rates': '运费标准',
  '/templates': '运费模板',
  '/wizard': '模板推荐向导',
  '/settings': '参数设置',
};

const Layout = () => {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? '速卖通定价系统';
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'grid h-screen w-full gap-4 bg-background p-4 max-lg:pb-20',
        collapsed ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[256px_1fr]',
        'max-lg:grid-cols-1 max-lg:h-auto max-lg:min-h-screen'
      )}
    >
      <aside
        className={cn(
          'hidden rounded-xl border border-border bg-card p-4 shadow-xs lg:flex lg:flex-col',
          collapsed && 'lg:items-center'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 px-2 pb-1 pt-1',
            collapsed && 'lg:flex-col lg:gap-3'
          )}
        >
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-foreground">
                速卖通定价系统
              </p>
              <p className="text-xs text-muted-foreground">AliExpress Pricing</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v: boolean) => !v)}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed && 'mx-auto'
            )}
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav
          className={cn(
            'mt-4 flex flex-col gap-1',
            collapsed && 'lg:items-center'
          )}
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex min-h-9 items-center rounded-md text-[13px] transition-colors',
                  collapsed ? 'w-9 justify-center' : 'gap-2.5 px-2.5 py-2',
                  isActive
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <item.icon size={16} strokeWidth={1.5} className="shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="mt-auto px-2 pt-4 text-xs text-muted-foreground">
            基于官方渠道运费标准
          </div>
        )}
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs max-lg:overflow-visible">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
          <span className="text-sm font-medium text-foreground">{pageTitle}</span>
          <span className="text-xs text-muted-foreground">运营定价工具</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8 pt-6 max-lg:overflow-visible">
          <Outlet />
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card py-2 shadow-xs lg:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 rounded-md px-3 py-1 text-[10px] transition-colors',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <item.icon size={18} strokeWidth={1.5} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </section>
    </div>
  );
};

export default Layout;
