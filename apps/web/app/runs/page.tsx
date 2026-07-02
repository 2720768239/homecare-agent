'use client';

// Agent 执行记录列表（路由 /runs）—— 从左侧抽屉进入。
// 每条记录展示：任务标题 / 输入摘要 / 识别意图 / 执行状态 / 是否等待确认 / 节点数量 / 创建时间。
// （DESIGN.md §12.8）

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell/AppShell';
import { AuthGuard } from '@/components/app-shell/AuthGuard';
import { SubHeader } from '@/components/app-shell/SubHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronRightIcon } from '@/components/ui/Icon';
import { api } from '@/lib/api-client';
import type { AgentRun } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

export default function RunsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <div className="flex h-[100dvh] flex-col">
          <SubHeader title="Agent 执行记录" backHref="/" />
          <RunsContent />
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function RunsContent() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listAgentRuns().then((r) => {
      setRuns(r.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    });
  }, []);

  return (
    <main className="safe-x flex-1 overflow-y-auto pb-6">
      {loading ? (
        <p className="py-8 text-center text-[13px] text-ink-tertiary">加载中...</p>
      ) : runs.length === 0 ? (
        <EmptyState
          title="暂无执行记录"
          description="在 Agent 主界面发起任务后，执行记录会出现在这里。"
          action={
            <Link href="/" className="btn-primary">
              去发任务
            </Link>
          }
        />
      ) : (
        <div className="space-y-2 py-3">
          {runs.map((r) => (
            <RunListItem key={r.id} run={r} />
          ))}
        </div>
      )}
    </main>
  );
}

function RunListItem({ run }: { run: AgentRun }) {
  return (
    <Link
      href={`/runs/${run.id}`}
      className="block rounded-2xl border border-line bg-bg px-4 py-3 active:bg-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
          {run.userInput || '（无输入）'}
        </p>
        <StatusChip status={run.status} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-tertiary">
        <span>{intentZh(run.intent)}</span>
        <span>· {run.nodePath.length} 个节点</span>
        {run.waitingFor && <span className="text-warn-text">· 等待确认</span>}
        <span>· {formatDateTime(run.createdAt)}</span>
      </div>
    </Link>
  );
}

function StatusChip({ status }: { status: AgentRun['status'] }) {
  const map: Record<AgentRun['status'], { label: string; cls: string }> = {
    running: { label: '执行中', cls: 'bg-muted text-ink-secondary' },
    waiting_confirmation: { label: '待确认', cls: 'bg-warn-bg/60 text-warn-text' },
    completed: { label: '已完成', cls: 'bg-[#ECFDF5] text-ok-text' },
    failed: { label: '失败', cls: 'bg-danger-bg text-danger-text' },
    cancelled: { label: '已取消', cls: 'bg-muted text-ink-tertiary' },
  };
  const s = map[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${s.cls}`}>{s.label}</span>;
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
