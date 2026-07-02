'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { WarrantyBadge } from '@/components/ui/WarrantyBadge';
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  DeviceIcon,
  EditIcon,
  FileIcon,
  ShieldIcon,
  SourceIcon,
  WarningIcon,
} from '@/components/ui/Icon';
import type {
  AgentResult,
  AgentRun,
  Attachment,
  DeviceDraft,
} from '@/lib/types';
import { calcWarrantyStatus, WARRANTY_STATUS_LABEL } from '@/lib/warranty';
import { formatDate, todayISO } from '@/lib/format';
import { useConversationStore } from '@/store/conversation-store';

// ---------------- DeviceDraftCard ----------------

export function DeviceDraftCard({ run }: { run: AgentRun }) {
  const draft = run.result?.deviceDraft!;
  const confirm = useConversationStore((s) => s.confirm);
  const running = useConversationStore((s) => s.running);
  const [editOpen, setEditOpen] = useState(false);
  const [allFieldsOpen, setAllFieldsOpen] = useState(false);

  const ws = calcWarrantyStatus(draft.purchaseDate, draft.warrantyMonths);
  const atts = (draft.sourceAttachmentIds || []).length;

  return (
    <div className="card space-y-4 p-4">
      <p className="text-[13px] font-medium text-ink-secondary">设备草稿</p>

      <div className="flex gap-4">
        <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[14px] bg-surface text-ink-tertiary">
          <DeviceIcon size={34} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[19px] font-semibold leading-[24px] text-ink">{draft.name}</h3>
          <p className="mt-2 truncate text-[13px] text-ink-secondary">
            {[draft.category, draft.brand, draft.model].filter(Boolean).join(' · ') || '品牌型号待补充'}
          </p>
          <p className="mt-2 text-[13px] font-medium text-ok-text">
            {ws.expireDate ? `${WARRANTY_STATUS_LABEL[ws.status]} · 预计至 ${formatDate(ws.expireDate)}` : WARRANTY_STATUS_LABEL[ws.status]}
          </p>
        </div>
      </div>

      <div className="h-px bg-line" />

      <div className="space-y-5">
        <InfoBlock label="已识别附件" value={atts ? `${atts} 个附件` : '暂无附件'} />
        {draft.suggestedReminders[0] && <InfoBlock label="建议提醒" value={draft.suggestedReminders[0].title} />}
      </div>

      {draft.missingFields.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-semibold text-warn-text">缺失字段</p>
          <div className="flex flex-wrap gap-2">
            {draft.missingFields.map((f) => (
              <span key={f} className="rounded-[7px] bg-warn-bg px-2.5 py-1 text-xs font-medium text-warn-text">
                {fieldZh(f)}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setAllFieldsOpen(true)}
        className="flex w-full items-center justify-start gap-2 rounded-xl py-1 text-[14px] font-medium text-ink-secondary active:opacity-60"
      >
        <span>查看全部字段</span>
        <ChevronRightIcon size={16} />
      </button>

      <div className="space-y-2 pt-0">
        <button
          onClick={() => confirm(run.id, 'confirm_device_draft')}
          disabled={running}
          className="btn-primary w-full disabled:opacity-50"
        >
          确认创建
        </button>
        <button
          onClick={() => setEditOpen(true)}
          disabled={running}
          className="btn-secondary w-full disabled:opacity-50"
        >
          修改信息
        </button>
        <button
          onClick={() => confirm(run.id, 'cancel_device_draft')}
          disabled={running}
          className="btn-ghost w-full disabled:opacity-50"
        >
          取消
        </button>
      </div>

      <DeviceDraftAllFieldsSheet
        open={allFieldsOpen}
        onClose={() => setAllFieldsOpen(false)}
        draft={draft}
      />
      <DeviceDraftEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        draft={draft}
        onSaved={(patch) => {
          confirm(run.id, 'modify_device_draft', { patch });
          setEditOpen(false);
        }}
      />
    </div>
  );
}

function fieldZh(f: string) {
  return (
    {
      serial_number: '序列号',
      purchase_date: '购买日期',
      purchase_channel: '购买渠道',
      brand: '品牌',
      model: '型号',
    } as Record<string, string>
  )[f] || f;
}

function DeviceDraftAllFieldsSheet({
  open,
  onClose,
  draft,
}: {
  open: boolean;
  onClose: () => void;
  draft: DeviceDraft;
}) {
  const ws = calcWarrantyStatus(draft.purchaseDate, draft.warrantyMonths);
  return (
    <BottomSheet open={open} onClose={onClose} title="全部字段">
      <div className="space-y-1.5 pb-2">
        <Row label="设备名称" value={draft.name} />
        <Row label="品牌" value={draft.brand || '—'} />
        <Row label="型号" value={draft.model || '—'} />
        <Row label="分类" value={draft.category || '—'} />
        <Row label="购买日期" value={draft.purchaseDate ? formatDate(draft.purchaseDate) : '—'} />
        <Row label="保修期" value={draft.warrantyMonths ? `${draft.warrantyMonths} 个月` : '—'} />
        <Row label="保修截止" value={ws.expireDate ? formatDate(ws.expireDate) : '—'} />
        <Row label="序列号" value={draft.serialNumber || '—'} />
        <Row label="购买渠道" value={draft.purchaseChannel || '—'} />
        <Row label="识别置信度" value={`${Math.round(draft.confidence * 100)}%`} />
      </div>
    </BottomSheet>
  );
}

function DeviceDraftEditSheet({
  open,
  onClose,
  draft,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft: DeviceDraft;
  onSaved: (patch: Partial<DeviceDraft>) => void;
}) {
  const [form, setForm] = useState({
    name: draft.name || '',
    brand: draft.brand || '',
    model: draft.model || '',
    category: draft.category || '',
    purchaseDate: draft.purchaseDate || '',
    warrantyMonths: draft.warrantyMonths?.toString() || '',
    serialNumber: draft.serialNumber || '',
    purchaseChannel: draft.purchaseChannel || '',
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="修改设备信息"
      footer={
        <button
          onClick={() =>
            onSaved({
              ...form,
              warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : undefined,
              purchaseDate: form.purchaseDate || undefined,
            })
          }
          className="btn-primary mb-2 w-full"
        >
          保存修改
        </button>
      }
    >
      <div className="space-y-3 pb-2">
        <FieldInput label="设备名称" value={form.name} onChange={(v) => set('name', v)} />
        <FieldInput label="品牌" value={form.brand} onChange={(v) => set('brand', v)} />
        <FieldInput label="型号" value={form.model} onChange={(v) => set('model', v)} />
        <FieldInput label="分类" value={form.category} onChange={(v) => set('category', v)} />
        <FieldInput
          label="购买日期"
          type="date"
          value={form.purchaseDate}
          onChange={(v) => set('purchaseDate', v)}
        />
        <FieldInput
          label="保修期（月）"
          type="number"
          value={form.warrantyMonths}
          onChange={(v) => set('warrantyMonths', v)}
        />
        <FieldInput
          label="序列号"
          value={form.serialNumber}
          onChange={(v) => set('serialNumber', v)}
        />
        <FieldInput
          label="购买渠道"
          value={form.purchaseChannel}
          onChange={(v) => set('purchaseChannel', v)}
        />
      </div>
    </BottomSheet>
  );
}

// ---------------- DeviceCreateSuccessCard ----------------

export function DeviceCreateSuccessCard({ run }: { run: AgentRun }) {
  const device = run.result?.device;
  const atts = run.result?.attachments || [];
  const reminder = run.result?.reminder;
  if (!device) return null;
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] text-ok-text">
          <CheckIcon size={18} />
        </span>
        <div>
          <p className="text-[15px] font-semibold text-ink">建档成功</p>
          <p className="text-xs text-ink-secondary">{run.result?.message}</p>
        </div>
      </div>
      <div className="rounded-xl bg-surface px-4 py-3">
        <p className="text-[15px] font-medium text-ink">{device.name}</p>
        <p className="mt-0.5 text-[13px] text-ink-secondary">
          {[device.brand, device.model].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip">绑定 {atts.length} 个附件</span>
          {reminder && <span className="chip">已生成保修提醒</span>}
        </div>
      </div>
      <Link href={`/devices/${device.id}`} className="btn-primary w-full">
        查看设备
      </Link>
    </div>
  );
}

// ---------------- DeviceSelectionCard ----------------

export function DeviceSelectionCard({ run }: { run: AgentRun }) {
  const candidates = run.result?.candidates || [];
  const confirm = useConversationStore((s) => s.confirm);
  const running = useConversationStore((s) => s.running);
  return (
    <div className="card space-y-3">
      <p className="text-[15px] font-semibold text-ink">{run.result?.message || '你说的是哪台设备？'}</p>
      <div className="space-y-2">
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => confirm(run.id, 'select_device', { deviceId: c.id })}
            disabled={running}
            className="flex w-full items-center justify-between rounded-xl border border-line bg-bg px-4 py-3 text-left active:bg-muted disabled:opacity-50"
          >
            <div>
              <p className="text-[15px] font-medium text-ink">{c.name}</p>
              <p className="mt-0.5 text-[13px] text-ink-secondary">
                {[c.brand, c.model].filter(Boolean).join(' · ')}
              </p>
            </div>
            <WarrantyBadge status={c.warrantyStatus} />
          </button>
        ))}
      </div>
      <button
        onClick={() => confirm(run.id, 'cancel_device_draft')}
        disabled={running}
        className="btn-ghost w-full disabled:opacity-50"
      >
        都不是
      </button>
    </div>
  );
}

// ---------------- ManualAnswerCard ----------------

export function ManualAnswerCard({ run }: { run: AgentRun }) {
  const ans = run.result?.manualAnswer!;
  const [sourceOpen, setSourceOpen] = useState(false);
  const src = ans.sources[0];
  return (
    <div className="card space-y-3">
      <p className="text-xs text-ink-secondary">说明书回答</p>
      <p className="text-[15px] leading-relaxed text-ink">{ans.summary}</p>
      {ans.steps && ans.steps.length > 0 && (
        <ol className="space-y-1.5 rounded-xl bg-surface px-4 py-3">
          {ans.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-ink">
              <span className="font-semibold text-ink-secondary">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
      {src && (
        <button
          onClick={() => setSourceOpen(true)}
          className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-2.5 active:bg-muted"
        >
          <span className="flex items-center gap-2 text-[13px] text-ink-secondary">
            <SourceIcon size={16} />
            来源：{src.fileName}
            {src.pageNumber ? ` · 第 ${src.pageNumber} 页` : ''}
          </span>
          <ChevronRightIcon size={16} className="text-ink-tertiary" />
        </button>
      )}
      <ManualSourceSheet open={sourceOpen} onClose={() => setSourceOpen(false)} source={src} />
    </div>
  );
}

function ManualSourceSheet({
  open,
  onClose,
  source,
}: {
  open: boolean;
  onClose: () => void;
  source: NonNullable<AgentResult['manualAnswer']>['sources'][number] | undefined;
}) {
  if (!source) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="来源详情">
      <div className="space-y-3 pb-2">
        <div className="rounded-xl bg-surface px-4 py-3">
          <p className="text-[13px] text-ink-secondary">来源文件</p>
          <p className="mt-1 flex items-center gap-2 text-[15px] font-medium text-ink">
            <FileIcon size={18} />
            {source.fileName}
          </p>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {source.section ? `${source.section} · ` : ''}第 {source.pageNumber || 1} 页
          </p>
        </div>
        <div>
          <p className="mb-1 text-[13px] text-ink-secondary">来源片段</p>
          <p className="rounded-xl border border-line bg-bg px-4 py-3 text-[14px] leading-relaxed text-ink">
            {source.snippet}
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}

// ---------------- ManualNoSourceCard ----------------

export function ManualNoSourceCard({ run }: { run: AgentRun }) {
  const reason = run.result?.manualNoSourceReason;
  return (
    <div className="card space-y-2">
      <div className="flex items-start gap-2">
        <InfoTipIcon />
        <p className="text-[15px] font-semibold text-ink">
          {reason === 'no_manual' ? '这台设备还没有说明书' : '未在说明书中找到答案'}
        </p>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-secondary">
        {run.result?.message}
      </p>
    </div>
  );
}

function InfoTipIcon() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-ink-secondary">
      <WarningIcon size={14} />
    </span>
  );
}

// ---------------- WarrantyResultCard ----------------

export function WarrantyResultCard({ run }: { run: AgentRun }) {
  const w = run.result?.warrantyResult!;
  return (
    <div className="card space-y-4">
      <div>
        <p className="text-xs text-ink-secondary">保修查询</p>
        <h3 className="mt-1 text-[17px] font-semibold text-ink">{w.deviceName}</h3>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
        <span className="text-[14px] text-ink-secondary">当前状态</span>
        <WarrantyBadge status={w.status} />
      </div>
      <div className="space-y-1.5">
        <Row label="购买日期" value={w.purchaseDate ? formatDate(w.purchaseDate) : '—'} />
        <Row label="保修期" value={w.warrantyMonths ? `${w.warrantyMonths} 个月` : '—'} />
        <Row
          label="保修截止"
          value={w.warrantyExpireDate ? formatDate(w.warrantyExpireDate) : '—'}
        />
        {w.status === 'active' && w.daysRemaining != null && (
          <Row label="剩余天数" value={`还有 ${w.daysRemaining} 天`} />
        )}
        {w.status === 'expiring' && w.daysRemaining != null && (
          <Row label="剩余天数" value={`仅剩 ${w.daysRemaining} 天`} />
        )}
        {w.status === 'expired' && (
          <Row label="已过保" value={w.warrantyExpireDate ? `自 ${formatDate(w.warrantyExpireDate)}` : '—'} />
        )}
      </div>
      {w.status === 'unknown' && (
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          可以在设备详情里补充购买日期和保修期，我就能帮你算出准确状态。
        </p>
      )}
    </div>
  );
}

// ---------------- TroubleshootingResultCard ----------------

export function TroubleshootingResultCard({ run }: { run: AgentRun }) {
  const tr = run.result?.troubleshooting!;
  const requestSave = useConversationStore((s) => s.requestSaveFault);
  const running = useConversationStore((s) => s.running);
  const [scriptOpen, setScriptOpen] = useState(false);
  const device = useDeviceName(tr.deviceId);

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="text-[19px] font-semibold leading-[24px] text-ink">
          {run.result?.message || `${tr.deviceName || device || '设备'}处理建议`}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {tr.riskLevel !== 'low' && (
            <span className="rounded-lg bg-danger-bg px-2.5 py-1 text-xs font-medium text-danger-text">
              安全风险
            </span>
          )}
          <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-ink-secondary">
            建议联系售后
          </span>
        </div>
      </div>

      {tr.safetyAlert && (
        <div className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-danger-text">
            <WarningIcon size={16} />
            {tr.safetyAlert.title}
          </p>
          <p className="mt-1 text-[12px] leading-4 text-danger-text">{tr.safetyAlert.message}</p>
        </div>
      )}

      <div>
        <p className="mb-3 text-[15px] font-semibold text-ink">先做这几件事</p>
        <ol className="space-y-2">
          {tr.actions.map((a, i) => (
            <li key={i} className="flex items-center gap-3 text-[13px] text-ink">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-ink-secondary">
                {i + 1}
              </span>
              <span>{a}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-2 text-[14px] font-semibold text-ink">售后沟通文案</p>
        <button
        onClick={() => setScriptOpen(true)}
          className="flex h-[42px] w-full items-center justify-between rounded-xl bg-muted px-4 text-[12px] text-ink-secondary active:bg-surface"
        >
          <span>已生成官方售后说明，可一键复制</span>
          <CopyIcon size={18} className="text-ink" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink">需要准备</span>
        {tr.materials.map((m) => (
          <span key={m} className="chip h-[22px]">{m}</span>
        ))}
      </div>

      <button
        onClick={() => requestSave(run.id)}
        disabled={running}
        className="btn-primary w-full disabled:opacity-50"
      >
        保存故障记录
      </button>

      <ServiceScriptSheet
        open={scriptOpen}
        onClose={() => setScriptOpen(false)}
        text={tr.supportMessage}
      />
    </div>
  );
}

function ServiceScriptSheet({
  open,
  onClose,
  text,
}: {
  open: boolean;
  onClose: () => void;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="售后沟通文案"
      footer={
        <button onClick={copy} className="btn-primary mb-2 w-full">
          {copied ? '已复制' : '复制文案'}
        </button>
      }
    >
      <p className="rounded-xl border border-line bg-bg px-4 py-3 text-[14px] leading-relaxed text-ink">
        {text}
      </p>
      <p className="mt-2 text-xs text-ink-tertiary">
        可在联系官方售后时直接粘贴，记得补充序列号等必要信息。
      </p>
    </BottomSheet>
  );
}

// ---------------- HighRiskSafetyCard ----------------

export function HighRiskSafetyCard({ run }: { run: AgentRun }) {
  const sb = run.result?.safetyBlocked!;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-danger-border bg-danger-bg p-4">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-danger-text">
          <ShieldIcon size={20} />
          {sb.title}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-danger-text">{sb.message}</p>
        {sb.riskKeywords.length > 0 && (
          <p className="mt-2 text-xs text-danger-text/80">
            命中风险关键词：{sb.riskKeywords.join('、')}
          </p>
        )}
      </div>
      <div className="card space-y-2">
        <p className="text-[13px] font-medium text-ink">请按以下指引处理</p>
        <ol className="space-y-1.5">
          {sb.guidance.map((g, i) => (
            <li key={i} className="flex items-start gap-2 text-[14px] text-ink">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-ink-secondary">
                {i + 1}
              </span>
              <span>{g}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ---------------- SaveFaultRecordConfirmation ----------------

export function SaveFaultRecordConfirmation({ run }: { run: AgentRun }) {
  const fr = run.result?.faultRecord!;
  const confirm = useConversationStore((s) => s.confirm);
  const running = useConversationStore((s) => s.running);
  const device = useDeviceName(fr.deviceId);
  return (
    <div className="card space-y-3">
      <p className="text-[15px] font-semibold text-ink">确认保存故障记录</p>
      <div className="space-y-1.5 rounded-xl bg-surface px-4 py-3">
        <Row label="设备" value={device || '—'} />
        <Row label="记录类型" value="故障排查" />
        <Row label="标题" value={fr.title} />
        <Row label="日期" value={formatDate(fr.occurredAt)} />
        <Row label="风险等级" value={riskZh(fr.riskLevel)} />
      </div>
      <p className="text-[13px] leading-relaxed text-ink-secondary">{fr.summary}</p>
      <div className="space-y-2 pt-1">
        <button
          onClick={() => confirm(run.id, 'save_fault_record')}
          disabled={running}
          className="btn-primary w-full disabled:opacity-50"
        >
          确认保存
        </button>
        <button
          onClick={() => confirm(run.id, 'cancel_fault_record')}
          disabled={running}
          className="btn-ghost w-full disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ---------------- FaultRecordSavedCard ----------------

export function FaultRecordSavedCard({ run }: { run: AgentRun }) {
  const fr = run.result?.faultRecord;
  if (!fr) return null;
  return (
    <div className="card space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] text-ok-text">
          <CheckIcon size={18} />
        </span>
        <p className="text-[15px] font-semibold text-ink">已保存故障记录</p>
      </div>
      <p className="text-[13px] text-ink-secondary">{fr.title}</p>
      <Link href={`/devices/${fr.deviceId}`} className="btn-secondary mt-1 w-full">
        查看设备维修记录
      </Link>
    </div>
  );
}

// ---------------- ErrorCard ----------------

export function ErrorCard({ run }: { run: AgentRun }) {
  return (
    <div className="card space-y-2">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <WarningIcon size={18} className="text-warn-text" />
        无法完成
      </p>
      <p className="text-[13px] leading-relaxed text-ink-secondary">
        {run.result?.error?.message || run.errorMessage || '发生未知错误。'}
      </p>
    </div>
  );
}

// ---------------- helpers ----------------

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-ink">{label}</p>
      <p className="mt-2 text-[14px] leading-[18px] text-ink-secondary">{value}</p>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] text-ink-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-ink"
      />
    </label>
  );
}

function riskZh(r: string) {
  return ({ low: '低', medium: '中', high: '高' } as Record<string, string>)[r] || r;
}

// 读设备名的小 hook（不触发额外渲染）
function useDeviceName(id?: string) {
  const [name, setName] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let active = true;
    import('@/lib/api-client').then(({ api }) => {
      api.getDevice(id).then((d) => {
        if (active) setName(d?.name);
      });
    });
    return () => {
      active = false;
    };
  }, [id]);
  return name;
}

export { WARRANTY_STATUS_LABEL };
