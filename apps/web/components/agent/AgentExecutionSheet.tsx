'use client';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { CheckIcon, WarningIcon, CloseIcon, RefreshIcon } from '@/components/ui/Icon';
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

function StatusDot({ status }: { status: AgentRunNode['status'] }) {
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
  if (status === 'skipped')
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-ink-tertiary">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-tertiary" />
      </span>
    );
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-ink-tertiary">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-tertiary" />
    </span>
  );
}

const STATUS_LABEL: Record<AgentRunNode['status'], string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

export function AgentExecutionSheet({
  run,
  open,
  onClose,
}: {
  run: AgentRun;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="执行过程">
      <div className="pb-2">
        <div className="rounded-xl bg-surface px-4 py-3">
          <p className="text-[13px] text-ink-secondary">任务</p>
          <p className="mt-1 text-[14px] font-medium text-ink">
            {run.userInput || '（无输入）'}
          </p>
          <p className="mt-2 text-xs text-ink-tertiary">
            意图：{intentZh(run.intent)} · 状态：{runStatusZh(run.status)}
          </p>
        </div>

        <ol className="mt-4 space-y-3">
          {run.nodePath.map((n, i) => (
            <li key={`${n.name}-${i}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StatusDot status={n.status} />
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

        {run.errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger-border bg-danger-bg px-3 py-2.5">
            <WarningIcon size={18} className="mt-0.5 shrink-0 text-danger-text" />
            <p className="text-[13px] leading-snug text-danger-text">{run.errorMessage}</p>
          </div>
        )}
      </div>
    </BottomSheet>
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
