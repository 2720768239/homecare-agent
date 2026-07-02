'use client';

// 上传文件状态列表。覆盖 6 种状态（DESIGN.md §11.4）：
// 待上传 / 上传中 / 已上传 / 解析中 / 已解析 / 解析失败。
// 解析失败时提供恢复入口：重新上传 / 手动填写 / 仅保存附件。

import { CameraIcon, FileIcon, ImageIcon, RefreshIcon, CloseIcon } from '@/components/ui/Icon';
import type { Attachment, ParseStatus } from '@/lib/types';
import { formatBytes } from '@/lib/format';

const STATUS_LABEL: Record<ParseStatus, string> = {
  pending: '待上传',
  uploading: '上传中',
  uploaded: '已上传',
  parsing: '解析中',
  parsed: '已解析',
  failed: '解析失败',
};

function fileIcon(att: Attachment) {
  if (att.fileType === 'image') return <ImageIcon size={22} />;
  if (att.fileType === 'pdf') return <FileIcon size={22} />;
  return <FileIcon size={22} />;
}

interface UploadedFileCardProps {
  attachment: Attachment;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onManualFill?: (id: string) => void;
  onSaveAsAttachmentOnly?: (id: string) => void;
}

export function UploadedFileCard({
  attachment,
  onRemove,
  onRetry,
  onManualFill,
  onSaveAsAttachmentOnly,
}: UploadedFileCardProps) {
  const status = attachment.parseStatus;
  const failed = status === 'failed';
  const busy = status === 'uploading' || status === 'parsing';

  return (
    <div className="flex h-[52px] gap-2.5 rounded-[14px] border border-line bg-bg px-3 py-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
        attachment.fileType === 'pdf' ? 'bg-danger-bg text-danger-text' : 'bg-surface text-ink-secondary'
      }`}>
        {fileIcon(attachment)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-[14px] text-ink">{attachment.filename}</p>
        <p
          className={`mt-1 text-[11px] font-medium leading-[12px] ${
            failed ? 'text-danger-text' : status === 'parsed' ? 'text-ok-text' : 'text-ink-secondary'
          }`}
        >
          {busy && (
            <RefreshIcon size={11} className="mr-1 inline-block animate-spin align-text-bottom" />
          )}
          {attachment.fileType === 'image' ? '图片' : attachment.fileType === 'pdf' ? 'PDF' : '文件'}
          {attachment.sizeBytes ? ` · ${formatBytes(attachment.sizeBytes)}` : ''}
          {` · ${STATUS_LABEL[status]}`}
          {status === 'parsed' ? ' ✓' : ''}
          {attachment.parseSummary && status === 'parsed' ? ` · ${attachment.parseSummary}` : ''}
          {attachment.parseError && failed ? ` · ${attachment.parseError}` : ''}
        </p>

        {failed && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => onRetry?.(attachment.id)}
              className="rounded-full bg-ink px-3 py-1 text-xs text-white active:opacity-70"
            >
              重新上传
            </button>
            <button
              onClick={() => onManualFill?.(attachment.id)}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink active:bg-muted"
            >
              手动填写
            </button>
            <button
              onClick={() => onSaveAsAttachmentOnly?.(attachment.id)}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink-secondary active:bg-muted"
            >
              仅保存附件
            </button>
          </div>
        )}
      </div>

      {!busy && (
        <button
          onClick={() => onRemove?.(attachment.id)}
          aria-label="删除"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-tertiary active:bg-muted"
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
}

interface FileStateListProps {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onManualFill?: (id: string) => void;
  onSaveAsAttachmentOnly?: (id: string) => void;
}

export function FileStateList({
  attachments,
  onRemove,
  onRetry,
  onManualFill,
  onSaveAsAttachmentOnly,
}: FileStateListProps) {
  if (attachments.length === 0) return null;
  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <UploadedFileCard
          key={a.id}
          attachment={a}
          onRemove={onRemove}
          onRetry={onRetry}
          onManualFill={onManualFill}
          onSaveAsAttachmentOnly={onSaveAsAttachmentOnly}
        />
      ))}
    </div>
  );
}

// 用于空状态占位（未上传任何文件时的提示）
export function EmptyUploadHint() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-3 py-2.5 text-[13px] text-ink-tertiary">
      <CameraIcon size={16} />
      <span>上传订单、发票、保修卡或说明书，我来帮你建档</span>
    </div>
  );
}
