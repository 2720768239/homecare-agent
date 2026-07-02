'use client';

// 设备详情（路由 /devices/[id]）。
// 第一屏：设备名称 / 品牌·型号·分类 / 保修状态 / 说明书·附件·记录数量 / 问说明书 / 故障售后。
// 后续：附件列表 + 故障记录列表（DESIGN.md §12.8）。

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell/AppShell';
import { AuthGuard } from '@/components/app-shell/AuthGuard';
import { SubHeader } from '@/components/app-shell/SubHeader';
import { WarrantyBadge } from '@/components/ui/WarrantyBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileIcon, ChevronRightIcon, InfoIcon } from '@/components/ui/Icon';
import { api } from '@/lib/api-client';
import type { AgentRun, Attachment, Device, FaultRecord } from '@/lib/types';
import { formatDate } from '@/lib/format';

export default function DeviceDetailPage({ params }: { params: { id: string } }) {
  return (
    <AuthGuard>
      <AppShell>
        <DeviceDetail id={params.id} />
      </AppShell>
    </AuthGuard>
  );
}

function DeviceDetail({ id }: { id: string }) {
  const router = useRouter();
  const [device, setDevice] = useState<Device | undefined>(undefined);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [faults, setFaults] = useState<FaultRecord[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getDevice(id),
      api.listAttachmentsByDevice(id),
      api.listFaultRecordsByDevice(id),
      api.listAgentRuns(),
    ]).then(([d, atts, fs, rs]) => {
      setDevice(d);
      setAttachments(atts);
      setFaults(fs);
      setRuns(rs.filter((r) => r.deviceId === id));
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <SubHeader title="设备详情" backHref="/devices" />
        <p className="py-8 text-center text-[13px] text-ink-tertiary">加载中...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <SubHeader title="设备详情" backHref="/devices" />
        <EmptyState
          title="设备不存在"
          description="该设备可能已被移除。"
          action={
            <Link href="/devices" className="btn-primary">
              返回设备库
            </Link>
          }
        />
      </div>
    );
  }

  const manuals = attachments.filter((a) => a.attachmentType === 'manual');
  const goAsk = () => router.push(`/?device=${id}`);
  const goTroubleshoot = () => router.push(`/?device=${id}`);

  return (
    <div className="flex h-[100dvh] flex-col">
      <SubHeader title={device.name} backHref="/devices" />
      <main className="safe-x flex-1 overflow-y-auto pb-6 pt-4">
        {/* 设备基本信息 */}
        <div className="card space-y-3">
          <div>
            <h2 className="text-[18px] font-semibold text-ink">{device.name}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              {[device.brand, device.model, device.category].filter(Boolean).join(' · ') || '品牌型号待补充'}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
            <span className="text-[14px] text-ink-secondary">保修状态</span>
            <WarrantyBadge status={device.warrantyStatus} />
          </div>
          <div className="space-y-1">
            <FieldRow label="购买日期" value={device.purchaseDate ? formatDate(device.purchaseDate) : '—'} />
            <FieldRow label="保修期" value={device.warrantyMonths ? `${device.warrantyMonths} 个月` : '—'} />
            <FieldRow label="保修截止" value={device.warrantyExpireDate ? formatDate(device.warrantyExpireDate) : '—'} />
            {device.serialNumber && <FieldRow label="序列号" value={device.serialNumber} />}
            {device.purchaseChannel && <FieldRow label="购买渠道" value={device.purchaseChannel} />}
          </div>
        </div>

        {/* 统计 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCard label="说明书" value={manuals.length} />
          <StatCard label="附件" value={attachments.length} />
          <StatCard label="维修记录" value={faults.length} />
        </div>

        {/* 主操作 */}
        <div className="mt-4 space-y-2">
          <button onClick={goAsk} className="btn-primary w-full">
            问说明书
          </button>
          <button onClick={goTroubleshoot} className="btn-secondary w-full">
            故障售后
          </button>
        </div>

        {/* 附件列表 */}
        {attachments.length > 0 && (
          <section className="mt-5">
            <p className="mb-2 text-[13px] font-medium text-ink-secondary">附件</p>
            <div className="space-y-2">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-2.5"
                >
                  <FileIcon size={18} className="shrink-0 text-ink-secondary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-ink">{a.filename}</p>
                    <p className="text-xs text-ink-tertiary">
                      {typeLabel(a.attachmentType)} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 故障记录 */}
        {faults.length > 0 && (
          <section className="mt-5">
            <p className="mb-2 text-[13px] font-medium text-ink-secondary">维修记录</p>
            <div className="space-y-2">
              {faults.map((f) => (
                <div key={f.id} className="card space-y-1">
                  <p className="text-[14px] font-medium text-ink">{f.title}</p>
                  <p className="text-[13px] text-ink-secondary">{f.summary}</p>
                  <p className="text-xs text-ink-tertiary">
                    {formatDate(f.occurredAt)} · 风险等级：{riskZh(f.riskLevel)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Agent 执行记录 */}
        {runs.length > 0 && (
          <section className="mt-5">
            <p className="mb-2 text-[13px] font-medium text-ink-secondary">Agent 执行记录</p>
            <div className="space-y-2">
              {runs.map((r) => (
                <Link
                  key={r.id}
                  href={`/runs/${r.id}`}
                  className="flex items-center justify-between rounded-xl border border-line bg-bg px-4 py-2.5 active:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-ink">{r.userInput || '（无输入）'}</p>
                    <p className="text-xs text-ink-tertiary">
                      {intentZh(r.intent)} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <ChevronRightIcon size={16} className="text-ink-tertiary" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[14px]">
      <span className="text-ink-secondary">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-3 text-center">
      <p className="text-[20px] font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-tertiary">{label}</p>
    </div>
  );
}

function typeLabel(t: string) {
  return (
    {
      order_screenshot: '订单截图',
      invoice: '发票',
      manual: '说明书',
      warranty_card: '保修卡',
      device_photo: '设备照片',
      repair_receipt: '维修凭证',
      other: '其他',
    } as Record<string, string>
  )[t] || t;
}

function riskZh(r: string) {
  return ({ low: '低', medium: '中', high: '高' } as Record<string, string>)[r] || r;
}

function intentZh(i: string) {
  return (
    {
      create_device: '自动建档',
      manual_qa: '说明书问答',
      warranty_check: '保修查询',
      troubleshooting: '故障售后',
      unknown: '未知',
    } as Record<string, string>
  )[i] || i;
}
