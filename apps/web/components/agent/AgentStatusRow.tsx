'use client';

import { useState } from 'react';
import { CheckIcon, ChevronRightIcon } from '@/components/ui/Icon';
import { AgentExecutionSheet } from './AgentExecutionSheet';
import type { AgentRun } from '@/lib/types';

// 轻量状态行：[✓] 已完成分析   [执行过程 >]
export function AgentStatusRow({ run }: { run: AgentRun }) {
  const [open, setOpen] = useState(false);
  const label =
    run.status === 'running'
      ? '正在分析'
      : run.status === 'waiting_confirmation'
        ? '等待你确认'
        : run.status === 'failed'
          ? '分析失败'
          : run.status === 'cancelled'
            ? '已取消'
            : '已完成分析';
  const done = run.status === 'completed';

  return (
    <>
      <div className="flex items-center justify-between py-1">
        <span className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <span
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
              done ? 'bg-bg text-ink-secondary' : 'bg-bg text-ink-secondary'
            }`}
          >
            <CheckIcon size={12} />
          </span>
          {label}
        </span>
        <button
          onClick={() => setOpen(true)}
          className="flex h-[30px] items-center gap-1 rounded-full border border-line bg-surface px-4 text-[13px] text-ink-secondary active:bg-muted"
        >
          执行过程
          <ChevronRightIcon size={14} />
        </button>
      </div>
      <AgentExecutionSheet run={run} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
