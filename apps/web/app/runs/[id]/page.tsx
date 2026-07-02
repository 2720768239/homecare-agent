'use client';

// Agent 执行记录详情（路由 /runs/[id]）。
// 展示：任务标题 / 输入 / 意图 / 状态 / 完整节点路径 / 结果摘要 / 错误信息。
// 复用 AgentExecutionSheet 的节点时间线展示逻辑（但直接内联在页面中，不作为 Sheet）。

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell/AppShell';
import { AuthGuard } from '@/components/app-shell/AuthGuard';
import { SubHeader } from '@/components/app-shell/SubHeader';
import { CheckIcon, CloseIcon, RefreshIcon } from '@/components/ui/Icon';
import { AgentResultRenderer } from '@/components/agent/AgentResultRenderer';
import { api } from '@/lib/api-client';
import type { AgentRun, AgentRunNode } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

const NODE_LABEL: Record<string, string> = {
  input_normalize: '理解输入',
  intent_classify: '识别意图',
  resolve_device_context: '匹配设备',
  load_attachments: '加载附件',
  extract_device_info: '提取设备字段',
  normalize_device_draft: '生成设备草稿',
  wait_user_confirmation: '等待用户确认',
  check_manual_exists: '检查说明书',
  retrieve_manual_chunks: '检索说明书片段',
  generate_manual_answer: '生成回答',
  calculate_warranty_status: '计算保修状态',
  safety_check: '安全检查',
  generate_troubleshooting_result: '生成排查建议',
  render_result: '生成结果',
  persist_agent_run: '记录执行',
  apply_user_confirmation: '处理用户操作',
  create_device: '创建设备',
  attach_files_to_device: '绑定附件',
  create_warranty_reminder: '创建保修提醒',
  index_manual_if_exists: '索引说明书',
  save_maintenance_record: '保存故障记录',
  final_response: '完成',
  route_by_intent: '路由',
  wait_device_selection: '等待选择设备',
  wait_save_record_confirmation: '等待确认保存',
};

const STATUS_LABEL: Record<AgentRunNode['status'], string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

export default function RunDetailPage({ params }: { params: { id: string } }) {
  return (
    <AuthGuard>
      <AppShell>
        <RunDetail id={params.id} />
      </AppShell>
    </AuthGuard>
  );
}

function RunDetail({ id }: { id: string }) {
  const [run, setRun] = useState<AgentRun | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgentRun(id).then((r) => {
      setRun(r);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <SubHeader title="执行记录" backHref="/runs" />
        <p className="py-8 text-center text-[13px] text-ink-tertiary">加载中...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <SubHeader title="执行记录" backHref="/runs" />
        <p className="py-8 text-center text-[13px] text-ink-tertiary">记录不存在</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <SubHeader title="执行记录" backHref="/runs" />
      <main className="safe-x flex-1 overflow-y-auto pb-6 pt-4">
        {/* 任务概要 */}
        <div className="card space-y-2">
          <p className="text-[15px] font-medium text-ink">{run.userInput || '（无输入）'}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-tertiary">
            <span>意图：{intentZh(run.intent)}</span>
            <span>· 状态：{runStatusZh(run.status)}</span>
            <span>· {formatDateTime(run.createdAt)}</span>
          </div>
          {run.waitingFor && (
            <p className="text-[13px] text-warn-text">等待确认：{run.waitingFor}</p>
          )}
        </div>

        {/* 节点路径 */}
        <section className="mt-4">
          <p className="mb-2 text-[13px] font-medium text-ink-secondary">执行过程</p>
          <div className="card">
            <ol className="space-y-3">
              {run.nodePath.map((n, i) => (
                <li key={`${n.name}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <NodeStatusDot status={n.status} />
                    {i < run.nodePath.length - 1 && (
                      <span className="my-1 w-px flex-1 bg-line" style={{ minHeight: 12 }} />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-[14px] font-medium text-ink">
                      {NODE_LABEL[n.name] || n.name}
                    </p>
                    {n.summary && (
                      <p className="mt-0.5 text-[13px] text-ink-secondary">{n.summary}</p>
                    )}
                    <p className="mt-0.5 text-xs text-ink-tertiary">
                      {STATUS_LABEL[n.status]}
                      {n.endedAt ? ` · ${formatDateTime(n.endedAt)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 错误信息 */}
        {run.errorMessage && (
          <section className="mt-4">
            <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3">
              <p className="text-[13px] font-medium text-danger-text">错误</p>
              <p className="mt-1 text-[13px] leading-relaxed text-danger-text">
                {run.errorMessage}
              </p>
            </div>
          </section>
        )}

        {/* 结果 */}
        {run.result && (
          <section className="mt-4">
            <p className="mb-2 text-[13px] font-medium text-ink-secondary">结果</p>
            <AgentResultRenderer run={run} />
          </section>
        )}
      </main>
    </div>
  );
}

function NodeStatusDot({ status }: { status: AgentRunNode['status'] }) {
  if (status === 'completed')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ECFDF5] text-ok-text">
        <CheckIcon size={14} />
      </span>
    );
  if (status === 'running')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-ink-secondary">
        <RefreshIcon size={14} />
      </span>
    );
  if (status === 'failed')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-danger-bg text-danger-text">
        <CloseIcon size={14} />
      </span>
    );
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-ink-tertiary">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-tertiary" />
    </span>
  );
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

function runStatusZh(s: string) {
  return (
    {
      running: '执行中',
      waiting_confirmation: '等待确认',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    } as Record<string, string>
  )[s] || s;
}
