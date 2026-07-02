'use client';

// 设备库（路由 /devices）—— 从左侧抽屉进入，非底部 Tab。
// 包含：搜索框 / 需要关注 / 状态筛选 / 设备列表 / 添加设备入口（DESIGN.md §12.8）。

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell/AppShell';
import { AuthGuard } from '@/components/app-shell/AuthGuard';
import { SubHeader } from '@/components/app-shell/SubHeader';
import { WarrantyBadge } from '@/components/ui/WarrantyBadge';
import { SearchIcon, PlusIcon, ChevronRightIcon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api-client';
import type { Device, WarrantyStatus } from '@/lib/types';
import { formatDate } from '@/lib/format';

type Filter = 'all' | WarrantyStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '保修中' },
  { key: 'expiring', label: '即将过期' },
  { key: 'expired', label: '已过保' },
  { key: 'unknown', label: '未知' },
];

export default function DevicesPage() {
  return (
    <AuthGuard>
      <AppShell>
        <div className="flex h-[100dvh] flex-col">
          <SubHeader title="设备库" backHref="/" />
          <DevicesContent />
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function DevicesContent() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    api.listDevices().then((d) => {
      setDevices(d);
      setLoading(false);
    });
  }, []);

  const filtered = devices.filter((d) => {
    if (filter !== 'all' && d.warrantyStatus !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        (d.brand || '').toLowerCase().includes(q) ||
        (d.model || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const attention = devices.filter(
    (d) => d.warrantyStatus === 'expiring' || d.warrantyStatus === 'expired',
  );

  return (
    <main className="safe-x flex-1 overflow-y-auto pb-6">
      {/* 搜索框 */}
      <div className="sticky top-0 z-10 bg-bg py-3">
        <div className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3">
          <SearchIcon size={18} className="text-ink-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索设备名称、品牌、型号"
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-tertiary"
          />
        </div>
      </div>

      {/* 需要关注 */}
      {!query && filter === 'all' && attention.length > 0 && (
        <section className="mt-2">
          <p className="mb-2 text-[13px] font-medium text-ink-secondary">需要关注</p>
          <div className="space-y-2">
            {attention.map((d) => (
              <DeviceCard key={d.id} device={d} attention />
            ))}
          </div>
        </section>
      )}

      {/* 状态筛选 */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] ${
              filter === f.key
                ? 'bg-ink text-white'
                : 'bg-surface text-ink-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 设备列表 */}
      <section className="mt-3">
        {loading ? (
          <p className="py-8 text-center text-[13px] text-ink-tertiary">加载中...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="还没有设备"
            description="上传订单、发票或保修卡，让 Agent 帮你建档。"
            action={
              <Link href="/" className="btn-primary">
                去建档
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => (
              <DeviceCard key={d.id} device={d} />
            ))}
          </div>
        )}
      </section>

      {/* 添加设备入口 */}
      <Link
        href="/"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-3 text-[14px] text-ink-secondary active:bg-muted"
      >
        <PlusIcon size={16} />
        添加设备
      </Link>
    </main>
  );
}

function DeviceCard({ device, attention }: { device: Device; attention?: boolean }) {
  return (
    <Link
      href={`/devices/${device.id}`}
      className="flex items-center justify-between rounded-2xl border border-line bg-bg px-4 py-3 active:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ink">{device.name}</p>
        <p className="mt-0.5 text-[13px] text-ink-secondary">
          {[device.brand, device.model].filter(Boolean).join(' · ') || '品牌型号待补充'}
        </p>
        {attention && device.warrantyExpireDate && (
          <p className="mt-0.5 text-xs text-warn-text">
            保修至 {formatDate(device.warrantyExpireDate)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <WarrantyBadge status={device.warrantyStatus} />
        <ChevronRightIcon size={16} className="text-ink-tertiary" />
      </div>
    </Link>
  );
}
