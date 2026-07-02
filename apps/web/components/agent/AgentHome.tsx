'use client';

// Agent 主界面的中央内容区。
// 渲染：空状态（含快捷建议） / 消息列表（用户气泡 + Agent 状态行 + 结果卡）。
// 不渲染 Composer 和上传 Sheet（由 page.tsx 编排）。

import { useEffect, useState } from 'react';
import { useConversationStore } from '@/store/conversation-store';
import { AgentStatusRow } from './AgentStatusRow';
import { AgentResultRenderer } from './AgentResultRenderer';
import {
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  DeviceIcon,
  FileIcon,
  InfoIcon,
  WarningIcon,
} from '@/components/ui/Icon';
import { api } from '@/lib/api-client';
import type { AgentRun, Attachment, Device } from '@/lib/types';

const QUICK_SUGGESTIONS = [
  { label: '拍照建档', text: '上传订单帮我建档', icon: 'upload' },
  { label: '问说明书', text: '滤芯多久换一次？', icon: 'manual' },
  { label: '查保修', text: '我的净水器还在保修期吗？', icon: 'warranty' },
  { label: '故障售后', text: '扫地机器人不工作了', icon: 'troubleshoot' },
];

function SuggestionIcon({ kind }: { kind: string }) {
  const cls = 'flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink';
  switch (kind) {
    case 'upload':
      return (
        <span className={cls}>
          <CameraIcon size={19} />
        </span>
      );
    case 'manual':
      return (
        <span className={cls}>
          <InfoIcon size={18} />
        </span>
      );
    case 'warranty':
      return (
        <span className={cls}>
          <CheckIcon size={18} />
        </span>
      );
    case 'troubleshoot':
      return (
        <span className={cls}>
          <WarningIcon size={18} />
        </span>
      );
    default:
      return (
        <span className={cls}>
          <InfoIcon size={18} />
        </span>
      );
  }
}

export function AgentHome() {
  const messages = useConversationStore((s) => s.messages);
  const submit = useConversationStore((s) => s.submit);
  const running = useConversationStore((s) => s.running);
  const [devices, setDevices] = useState<Device[] | undefined>(undefined);

  useEffect(() => {
    api.listDevices().then(setDevices).catch(() => setDevices([]));
  }, []);

  const hasMessages = messages.length > 0;
  const hasDevices = (devices?.length ?? 0) > 0;
  const showEmpty = !hasMessages;

  if (showEmpty) {
    return (
      <EmptyState
        hasDevices={hasDevices}
        disabled={running}
        onPick={(text) => submit(text)}
      />
    );
  }

  return (
    <div className="space-y-4 pb-4 pt-3">
      {messages.map((m) =>
        m.role === 'user' ? (
          <UserBubble key={m.id} text={m.text} attachments={m.attachments} />
        ) : (
          <AgentBlock key={m.id} run={m.run} />
        ),
      )}
    </div>
  );
}

function EmptyState({
  hasDevices,
  disabled,
  onPick,
}: {
  hasDevices: boolean;
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="pb-5 pt-[42px] text-left">
      <h2 className="text-[27px] font-bold leading-[34px] text-ink">
        {hasDevices ? '今天要处理哪台设备？' : '今天要处理哪台设备？'}
      </h2>
      <p className="mt-5 text-[15px] leading-[18px] text-ink-secondary">
        {hasDevices
          ? '你可以拍照上传订单、发票、说明书或保修卡，也可以直接问我设备怎么用、是否还在保修、坏了怎么办。'
          : '你可以拍照上传订单、发票、说明书或保修卡，也可以直接问我设备怎么用、是否还在保修、坏了怎么办。'}
      </p>

      <p className="mobile-section-title mt-[30px]">快捷建议</p>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            disabled={disabled}
            onClick={() => onPick(s.text)}
            className="mobile-list-card flex h-[68px] items-center gap-3.5 px-4 text-left active:bg-muted disabled:opacity-50"
          >
            <SuggestionIcon kind={s.icon} />
            <span className="whitespace-nowrap text-[16px] font-semibold text-ink">{s.label}</span>
          </button>
        ))}
      </div>

      <p className="mobile-section-title mt-[44px]">需要关注</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick('我的戴森吸尘器还在保修期吗？')}
        className="mobile-list-card mt-5 flex h-[68px] w-full items-center gap-4 px-4 text-left active:bg-muted disabled:opacity-50"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-ink-secondary">
          <DeviceIcon size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-ink">戴森吸尘器 V12</span>
          <span className="mt-1 flex items-center gap-1 text-[14px] text-ink-secondary">
            <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-xs font-medium text-warn-text">
              即将过保
            </span>
            <span>· 12 天后过保</span>
          </span>
        </span>
        <ChevronRightIcon size={20} className="text-ink-secondary" />
      </button>

      <p className="mobile-section-title mt-9">最近任务</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick('查看最近建档任务')}
        className="mobile-list-card mt-5 flex h-[66px] w-full items-center gap-4 px-4 text-left active:bg-muted disabled:opacity-50"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-ink-secondary">
          <FileIcon size={23} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-ink">已为小米净水器建立档案</span>
          <span className="mt-1 block text-[13px] text-ink-secondary">今天 09:21</span>
        </span>
        <ChevronRightIcon size={20} className="text-ink-secondary" />
      </button>
    </div>
  );
}

function UserBubble({
  text,
  attachments,
}: {
  text: string;
  attachments?: Attachment[];
}) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[234px] rounded-[22px] bg-muted px-[18px] py-2.5">
        <p className="text-[14px] font-medium leading-[17px] text-ink">{text}</p>
        {attachments && attachments.length > 0 && (
          <p className="mt-1.5 text-xs text-ink-tertiary">附 {attachments.length} 个文件</p>
        )}
      </div>
    </div>
  );
}

function AgentBlock({ run }: { run: AgentRun }) {
  const showStatus = run.status !== 'completed' || run.nodePath.length > 0;
  const showResult =
    run.status === 'completed' ||
    run.status === 'waiting_confirmation' ||
    run.status === 'failed';
  return (
    <div className="space-y-2.5">
      {showStatus && <AgentStatusRow run={run} />}
      {showResult && <AgentResultRenderer run={run} />}
    </div>
  );
}
