// HomeCare Agent v0.1 — 内置 mock 后端
// 实现 EXECUTION_PLAN §8 API 契约与 §9 Agent 工作流骨架。
// 真实能力：保修计算、高风险安全判断、AgentRun 节点路径记录。
// mock 能力：文件解析、OCR、PDF 提取、说明书向量检索（用 seed chunks + 关键词命中）。
// 数据持久化到 localStorage，两个预置账号共享同一套 household_default 数据。

import type {
  AgentIntent,
  AgentResult,
  AgentRun,
  AgentRunNode,
  Attachment,
  AttachmentType,
  Device,
  FaultRecord,
  ManualChunkSeed,
  Reminder,
  Session,
  Settings,
  User,
} from './types';
import {
  HOUSEHOLD,
  PASSWORDS,
  SEED_AGENT_RUNS,
  SEED_ATTACHMENTS,
  SEED_DEVICES,
  SEED_FAULT_RECORDS,
  SEED_MANUAL_CHUNKS,
  SEED_REMINDERS,
  USERS,
} from './seed';
import { addMonths, calcWarrantyExpireDate, calcWarrantyStatus } from './warranty';
import { detectSafetyRisk, SAFETY_GUIDANCE, SAFETY_MESSAGE, SAFETY_TITLE } from './safety';
import { genId, todayISO } from './format';

const DB_KEY = 'homecare_db_v1';
const SESSION_KEY = 'homecare_session';

interface DB {
  devices: Device[];
  attachments: Attachment[];
  reminders: Reminder[];
  faultRecords: FaultRecord[];
  agentRuns: AgentRun[];
  manualChunks: ManualChunkSeed[];
}

function freshDB(): DB {
  return {
    devices: structuredCloneSafe(SEED_DEVICES),
    attachments: structuredCloneSafe(SEED_ATTACHMENTS),
    reminders: structuredCloneSafe(SEED_REMINDERS),
    faultRecords: structuredCloneSafe(SEED_FAULT_RECORDS),
    agentRuns: structuredCloneSafe(SEED_AGENT_RUNS),
    manualChunks: structuredCloneSafe(SEED_MANUAL_CHUNKS),
  };
}

function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function getDB(): DB {
  if (!isBrowser()) return freshDB();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const db = freshDB();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return db;
    }
    return JSON.parse(raw) as DB;
  } catch {
    return freshDB();
  }
}

function saveDB(db: DB): void {
  if (!isBrowser()) return;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ---------------- Session / Auth ----------------

export function getSession(): Session | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setSession(s: Session | null): void {
  if (!isBrowser()) return;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export function login(
  username: string,
  password: string,
): { ok: true; session: Session } | { ok: false; error: { code: string; message: string } } {
  const user = USERS.find((u) => u.username === username);
  if (!user || PASSWORDS[username] !== password) {
    return {
      ok: false,
      error: { code: 'INVALID_CREDENTIALS', message: '账号名或密码错误' },
    };
  }
  const session: Session = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    householdId: user.householdId,
    householdName: HOUSEHOLD.name,
    token: `mock-token-${user.id}-${Date.now()}`,
  };
  setSession(session);
  return { ok: true, session };
}

export function logout(): void {
  setSession(null);
}

export function me(): Session | null {
  return getSession();
}

// ---------------- Devices ----------------

export function listDevices(): Device[] {
  return getDB().devices
    .filter((d) => d.householdId === 'household_default')
    .map(recomputeWarranty)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getDevice(id: string): Device | undefined {
  return getDB()
    .devices.filter((d) => d.id === id)
    .map(recomputeWarranty)[0];
}

export function createDevice(
  input: Partial<Device>,
  userId: string,
): Device {
  const db = getDB();
  const now = new Date().toISOString();
  const ws = calcWarrantyStatus(input.purchaseDate, input.warrantyMonths);
  const device: Device = {
    id: genId('dev'),
    householdId: 'household_default',
    name: input.name || '未命名设备',
    brand: input.brand,
    model: input.model,
    category: input.category || '未分类',
    purchaseDate: input.purchaseDate,
    warrantyMonths: input.warrantyMonths,
    warrantyExpireDate: ws.expireDate,
    warrantyStatus: ws.status,
    serialNumber: input.serialNumber,
    purchaseChannel: input.purchaseChannel,
    servicePhone: input.servicePhone,
    notes: input.notes,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  };
  db.devices.push(device);
  saveDB(db);
  return device;
}

export function patchDevice(
  id: string,
  patch: Partial<Device>,
  userId: string,
): Device | undefined {
  const db = getDB();
  const idx = db.devices.findIndex((d) => d.id === id);
  if (idx < 0) return undefined;
  const prev = db.devices[idx];
  const next: Device = {
    ...prev,
    ...patch,
    id: prev.id,
    householdId: prev.householdId,
    updatedByUserId: userId,
    updatedAt: new Date().toISOString(),
  };
  const ws = calcWarrantyStatus(next.purchaseDate, next.warrantyMonths);
  next.warrantyExpireDate = ws.expireDate;
  next.warrantyStatus = ws.status;
  db.devices[idx] = next;
  saveDB(db);
  return next;
}

function recomputeWarranty(d: Device): Device {
  const ws = calcWarrantyStatus(d.purchaseDate, d.warrantyMonths);
  return { ...d, warrantyExpireDate: ws.expireDate, warrantyStatus: ws.status };
}

// ---------------- Attachments ----------------

export function listAttachmentsByDevice(deviceId: string): Attachment[] {
  return getDB().attachments.filter((a) => a.deviceId === deviceId);
}

export function getAttachment(id: string): Attachment | undefined {
  return getDB().attachments.find((a) => a.id === id);
}

export function registerAttachment(
  input: { filename: string; mimeType: string; sizeBytes?: number; attachmentType?: AttachmentType },
  userId: string,
): Attachment {
  const db = getDB();
  const fileType: Attachment['fileType'] = input.mimeType.startsWith('image/')
    ? 'image'
    : input.mimeType === 'application/pdf'
      ? 'pdf'
      : 'other';
  const att: Attachment = {
    id: genId('att'),
    householdId: 'household_default',
    filename: input.filename,
    mimeType: input.mimeType,
    fileType,
    attachmentType: input.attachmentType || 'other',
    sizeBytes: input.sizeBytes,
    parseStatus: 'pending',
    createdByUserId: userId,
    createdAt: new Date().toISOString(),
  };
  db.attachments.push(att);
  saveDB(db);
  return att;
}

// mock 解析：根据文件名推断附件类型与摘要
export function parseAttachment(id: string): Attachment {
  const db = getDB();
  const idx = db.attachments.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('attachment not found');
  const att = db.attachments[idx];
  const fn = att.filename.toLowerCase();
  let attachmentType: AttachmentType = att.attachmentType;
  let summary = '已解析文件内容';
  if (fn.includes('订单') || fn.includes('order')) {
    attachmentType = 'order_screenshot';
    summary = '识别到订单截图：商品名称、购买日期、订单号、金额';
  } else if (fn.includes('发票') || fn.includes('invoice')) {
    attachmentType = 'invoice';
    summary = '识别到发票：购买方、商品明细、开票日期';
  } else if (fn.includes('说明书') || fn.includes('manual') || att.mimeType === 'application/pdf') {
    attachmentType = 'manual';
    summary = '已提取说明书文本，可索引为问答来源';
  } else if (fn.includes('保修') || fn.includes('warranty')) {
    attachmentType = 'warranty_card';
    summary = '识别到保修卡：保修期、售后电话';
  } else if (fn.includes('故障') || fn.includes('fault')) {
    attachmentType = 'device_photo';
    summary = '识别到故障照片';
  }
  const updated: Attachment = {
    ...att,
    attachmentType,
    parseStatus: 'parsed',
    parseSummary: summary,
  };
  db.attachments[idx] = updated;
  saveDB(db);
  return updated;
}

export function setAttachmentParseStatus(
  id: string,
  status: Attachment['parseStatus'],
  error?: string,
): void {
  const db = getDB();
  const idx = db.attachments.findIndex((a) => a.id === id);
  if (idx < 0) return;
  db.attachments[idx] = {
    ...db.attachments[idx],
    parseStatus: status,
    parseError: error,
  };
  saveDB(db);
}

export function bindAttachmentsToDevice(
  attachmentIds: string[],
  deviceId: string,
): void {
  const db = getDB();
  db.attachments = db.attachments.map((a) =>
    attachmentIds.includes(a.id) ? { ...a, deviceId } : a,
  );
  saveDB(db);
}

// ---------------- Reminders ----------------

export function listReminders(): Reminder[] {
  return getDB()
    .reminders.filter((r) => r.householdId === 'household_default')
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

export function patchReminder(
  id: string,
  patch: Partial<Reminder>,
  userId: string,
): Reminder | undefined {
  const db = getDB();
  const idx = db.reminders.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  const next: Reminder = {
    ...db.reminders[idx],
    ...patch,
    id: db.reminders[idx].id,
    updatedByUserId: userId,
    updatedAt: new Date().toISOString(),
  };
  db.reminders[idx] = next;
  saveDB(db);
  return next;
}

export function createReminder(
  input: Partial<Reminder>,
  userId: string,
): Reminder {
  const db = getDB();
  const now = new Date().toISOString();
  const r: Reminder = {
    id: genId('rem'),
    householdId: 'household_default',
    deviceId: input.deviceId,
    type: input.type || 'custom',
    title: input.title || '提醒',
    description: input.description,
    dueDate: input.dueDate || todayISO(),
    status: 'pending',
    source: input.source || 'agent',
    sourceAgentRunId: input.sourceAgentRunId,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  };
  db.reminders.push(r);
  saveDB(db);
  return r;
}

// ---------------- Fault records ----------------

export function listFaultRecordsByDevice(deviceId: string): FaultRecord[] {
  return getDB().faultRecords.filter((f) => f.deviceId === deviceId);
}

export function createFaultRecord(
  input: Partial<FaultRecord>,
  userId: string,
): FaultRecord {
  const db = getDB();
  const now = new Date().toISOString();
  const fr: FaultRecord = {
    id: genId('fault'),
    householdId: 'household_default',
    deviceId: input.deviceId || '',
    agentRunId: input.agentRunId,
    type: input.type || 'troubleshooting',
    title: input.title || '故障记录',
    symptom: input.symptom || '',
    riskLevel: input.riskLevel || 'low',
    summary: input.summary || '',
    serviceScript: input.serviceScript,
    occurredAt: input.occurredAt || now,
    createdByUserId: userId,
    createdAt: now,
  };
  db.faultRecords.push(fr);
  saveDB(db);
  return fr;
}

// ---------------- Agent runs ----------------

export function listAgentRuns(): AgentRun[] {
  return getDB()
    .agentRuns.filter((r) => r.householdId === 'household_default')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getAgentRun(id: string): AgentRun | undefined {
  return getDB().agentRuns.find((r) => r.id === id);
}

function upsertAgentRun(db: DB, run: AgentRun): void {
  const idx = db.agentRuns.findIndex((r) => r.id === run.id);
  if (idx >= 0) db.agentRuns[idx] = run;
  else db.agentRuns.push(run);
}

// ---------------- Agent workflow (LangGraph skeleton) ----------------
// 节点：input_normalize → intent_classify → resolve_device_context → safety_check
//       → route_by_intent → {create_device|manual_qa|warranty_check|troubleshooting}
//       → render_result → persist_agent_run

function classifyIntent(input: string, hasAttachments: boolean, hint?: string): AgentIntent {
  if (hint === 'create_device' || hasAttachments) {
    if (/建档|添加设备|新建设备|上传|订单|发票|保修卡/.test(input) || hasAttachments) {
      return 'create_device';
    }
  }
  if (/说明书|怎么用|怎么清洗|怎么安装|滤芯|操作|使用方法/.test(input)) return 'manual_qa';
  if (/保修|还在保修|过保|保修期|保修多久/.test(input)) return 'warranty_check';
  if (/故障|漏水|坏了|不工作|异响|不制冷|不加热|售后|修|漏电|冒烟/.test(input))
    return 'troubleshooting';
  if (hint) return hint as AgentIntent;
  return 'unknown';
}

function resolveDevice(input: string, contextDeviceId?: string): {
  device?: Device;
  candidates?: Device[];
  ambiguous: boolean;
} {
  const devices = listDevices();
  if (contextDeviceId) {
    const d = devices.find((x) => x.id === contextDeviceId);
    return { device: d, ambiguous: false };
  }
  // 关键词命中设备名/品牌/型号
  const matched = devices.filter(
    (d) =>
      (d.name && input.includes(d.name)) ||
      (d.brand && input.includes(d.brand)) ||
      (d.model && input.includes(d.model)) ||
      (d.name && d.name.split(/[\s]+/).some((seg) => seg.length >= 2 && input.includes(seg))),
  );
  const unique = Array.from(new Set(matched.map((d) => d.id)))
    .map((id) => matched.find((d) => d.id === id)!);
  if (unique.length === 1) return { device: unique[0], ambiguous: false };
  if (unique.length > 1) return { candidates: unique, ambiguous: true };
  return { ambiguous: false };
}

function node(
  name: string,
  status: AgentRunNode['status'],
  summary?: string,
): AgentRunNode {
  const now = new Date().toISOString();
  return { name, status, startedAt: now, endedAt: now, summary };
}

export interface RunInput {
  inputText: string;
  intentHint?: AgentIntent;
  attachmentIds?: string[];
  context?: { deviceId?: string; source?: string };
  userId: string;
}

// 创建 AgentRun 并执行到第一个需要用户输入的节点（或完成）
export function startAgentRun(input: RunInput): AgentRun {
  const db = getDB();
  const now = new Date().toISOString();
  const hasAttachments = !!input.attachmentIds && input.attachmentIds.length > 0;
  const intent = classifyIntent(input.inputText, hasAttachments, input.intentHint);

  const run: AgentRun = {
    id: genId('run'),
    householdId: 'household_default',
    createdByUserId: input.userId,
    intent,
    userInput: input.inputText,
    status: 'running',
    attachmentIds: input.attachmentIds,
    context: input.context,
    nodePath: [],
    createdAt: now,
    updatedAt: now,
  };
  run.nodePath.push(node('input_normalize', 'completed', '解析用户输入'));
  run.nodePath.push(node('intent_classify', 'completed', `识别为 ${intentLabel(intent)}`));

  if (intent === 'create_device') {
    runCreateDeviceFlow(db, run, input);
  } else if (intent === 'manual_qa') {
    runManualQaFlow(db, run, input);
  } else if (intent === 'warranty_check') {
    runWarrantyFlow(db, run, input);
  } else if (intent === 'troubleshooting') {
    runTroubleshootingFlow(db, run, input);
  } else {
    run.nodePath.push(node('route_by_intent', 'skipped', '无法识别意图'));
    run.status = 'failed';
    run.errorMessage = '无法识别你的意图，可以试试上传资料建档，或问我说明书、保修、故障问题。';
    run.result = {
      type: 'error',
      error: { code: 'UNKNOWN_INTENT', message: run.errorMessage },
    };
    run.resultType = 'error';
  }

  upsertAgentRun(db, run);
  saveDB(db);
  return run;
}

function intentLabel(i: AgentIntent): string {
  switch (i) {
    case 'create_device':
      return '自动建档';
    case 'manual_qa':
      return '说明书问答';
    case 'warranty_check':
      return '保修查询';
    case 'troubleshooting':
      return '故障售后';
    default:
      return '未知意图';
  }
}

// ---- create_device flow ----
function runCreateDeviceFlow(db: DB, run: AgentRun, input: RunInput) {
  run.nodePath.push(node('load_attachments', 'completed', `加载 ${input.attachmentIds?.length || 0} 个附件`));
  const attachments = (input.attachmentIds || [])
    .map((id) => db.attachments.find((a) => a.id === id))
    .filter(Boolean) as Attachment[];

  if (attachments.length === 0) {
    run.nodePath.push(node('extract_device_info', 'failed', '没有可解析的附件'));
    run.status = 'failed';
    run.errorMessage = '还没有上传资料，请先点 + 上传订单截图、发票、说明书或保修卡。';
    run.result = { type: 'error', error: { code: 'NO_ATTACHMENTS', message: run.errorMessage } };
    run.resultType = 'error';
    return;
  }

  run.nodePath.push(node('extract_device_info', 'completed', '提取设备字段（mock）'));
  const draft = mockExtractDeviceFields(attachments);
  run.nodePath.push(node('normalize_device_draft', 'completed', `生成设备草稿，置信度 ${Math.round(draft.confidence * 100)}%`));

  run.status = 'waiting_confirmation';
  run.currentNode = 'wait_user_confirmation';
  run.waitingFor = 'device_draft_confirmation';
  run.result = {
    type: 'device_draft',
    message: '我从你上传的资料中识别到一台设备，请确认后再创建。',
    deviceDraft: draft,
  };
  run.resultType = 'device_draft';
  run.nodePath.push(node('wait_user_confirmation', 'completed', '等待用户确认'));
}

function mockExtractDeviceFields(attachments: Attachment[]) {
  // 演示用：根据附件类型拼装一份草稿。新建设备使用一个区别于 seed 的 demo 设备。
  const hasOrder = attachments.some((a) => a.attachmentType === 'order_screenshot' || /订单|order/i.test(a.filename));
  const hasManual = attachments.some((a) => a.attachmentType === 'manual' || /说明书|manual/i.test(a.filename) || a.fileType === 'pdf');
  const hasWarranty = attachments.some((a) => a.attachmentType === 'warranty_card' || /保修|warranty/i.test(a.filename));

  const missing: string[] = [];
  if (!hasOrder) missing.push('purchase_date', 'purchase_channel');
  if (!hasWarranty) missing.push('serial_number');

  const purchaseDate = hasOrder ? todayISO() : undefined;
  const warrantyMonths = hasWarranty ? 24 : 12;
  const expireDate = purchaseDate ? calcWarrantyExpireDate(purchaseDate, warrantyMonths) : undefined;

  return {
    id: genId('draft'),
    name: '九阳破壁机 Y88',
    brand: '九阳',
    model: 'Y88',
    category: '厨房设备',
    purchaseDate,
    warrantyMonths,
    warrantyExpireDate: expireDate,
    serialNumber: hasWarranty ? 'JY-Y88-2026-0001' : undefined,
    purchaseChannel: hasOrder ? '京东' : undefined,
    confidence: hasOrder && hasManual ? 0.86 : hasOrder || hasManual ? 0.72 : 0.6,
    missingFields: missing,
    sourceAttachmentIds: attachments.map((a) => a.id),
    suggestedReminders: purchaseDate
      ? [
          {
            type: 'warranty_expire' as const,
            title: '九阳破壁机 Y88 保修即将到期',
            dueDate: addMonths(purchaseDate, warrantyMonths - 1),
          },
        ]
      : [],
    status: 'pending_confirmation' as const,
  };
}

// ---- manual_qa flow ----
function runManualQaFlow(db: DB, run: AgentRun, input: RunInput) {
  const { device, candidates, ambiguous } = resolveDevice(input.inputText, input.context?.deviceId);
  run.nodePath.push(node('resolve_device_context', 'completed', device ? `命中 ${device.name}` : ambiguous ? '多候选设备' : '未命中设备'));

  if (ambiguous || (!device && !input.context?.deviceId)) {
    run.status = 'waiting_confirmation';
    run.waitingFor = 'device_selection';
    run.currentNode = 'wait_device_selection';
    run.result = {
      type: 'device_selection_required',
      message: '你说的是哪台设备？',
      candidates: (candidates || listDevices().slice(0, 3)).map((d) => ({
        id: d.id,
        name: d.name,
        brand: d.brand,
        model: d.model,
        category: d.category,
        warrantyStatus: d.warrantyStatus,
      })),
    };
    run.resultType = 'device_selection_required';
    run.nodePath.push(node('wait_device_selection', 'completed', '等待用户选择设备'));
    return;
  }

  const dev = device;
  if (!dev) {
    run.status = 'failed';
    run.errorMessage = '没有找到对应设备，请先在设备库中选择或在 Agent 里说明设备名称。';
    run.result = { type: 'error', error: { code: 'NO_DEVICE', message: run.errorMessage } };
    run.resultType = 'error';
    return;
  }
  run.deviceId = dev.id;

  run.nodePath.push(node('check_manual_exists', 'completed'));
  const chunks = db.manualChunks.filter((c) => c.deviceId === dev.id);
  const manualAtt = db.attachments.find(
    (a) => a.deviceId === dev.id && a.attachmentType === 'manual',
  );
  if (chunks.length === 0 || !manualAtt) {
    run.status = 'completed';
    run.result = {
      type: 'manual_no_source',
      manualNoSourceReason: 'no_manual',
      message: '这台设备还没有上传说明书。上传说明书后，我可以帮你回答使用方法、故障代码和保养步骤。',
    };
    run.resultType = 'manual_no_source';
    run.nodePath.push(node('retrieve_manual_chunks', 'skipped', '无说明书'));
    run.nodePath.push(node('persist_agent_run', 'completed', '已记录'));
    return;
  }

  run.nodePath.push(node('retrieve_manual_chunks', 'completed', `检索到 ${chunks.length} 条片段`));
  // mock 检索：关键词命中
  const keywords = extractKeywords(input.inputText);
  const hit = chunks
    .map((c) => ({ c, score: keywords.reduce((s, k) => s + (c.content.includes(k) || (c.section || '').includes(k) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (hit.length === 0) {
    run.status = 'completed';
    run.result = {
      type: 'manual_no_source',
      manualNoSourceReason: 'answer_not_found',
      message: '我没有在这台设备的说明书中找到明确答案。你可以换个问法，或上传更完整的说明书。',
    };
    run.resultType = 'manual_no_source';
    run.nodePath.push(node('generate_manual_answer', 'skipped', '未命中答案'));
    run.nodePath.push(node('persist_agent_run', 'completed', '已记录'));
    return;
  }

  const top = hit[0].c;
  run.status = 'completed';
  run.result = {
    type: 'manual_answer',
    manualAnswer: buildManualAnswer(top, manualAtt),
  };
  run.resultType = 'manual_answer';
  run.nodePath.push(node('generate_manual_answer', 'completed', '生成结构化答案'));
  run.nodePath.push(node('persist_agent_run', 'completed', '已记录'));
}

function extractKeywords(text: string): string[] {
  const stop = new Set(['的', '了', '怎么', '如何', '吗', '呢', '是', '在', '我', '请问', '一下', '帮', '帮忙']);
  return text
    .replace(/[，。？！,.?!]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stop.has(w));
}

function buildManualAnswer(chunk: ManualChunkSeed, att: Attachment) {
  const content = chunk.content;
  let steps: string[] | undefined;
  if (/清洗|更换|安装|操作/.test(content)) {
    const parts = content.split(/[：:；;]/).map((s) => s.trim()).filter(Boolean);
    steps = parts.length > 1 ? parts.slice(1) : undefined;
  }
  return {
    summary: content.split(/[，。；;]/)[0],
    steps,
    sources: [
      {
        attachmentId: att.id,
        fileName: att.filename,
        pageNumber: chunk.pageNumber,
        section: chunk.section,
        snippet: content,
      },
    ],
  };
}

// ---- warranty flow ----
function runWarrantyFlow(db: DB, run: AgentRun, input: RunInput) {
  const { device, candidates, ambiguous } = resolveDevice(input.inputText, input.context?.deviceId);
  run.nodePath.push(node('resolve_device_context', 'completed', device ? `命中 ${device.name}` : ambiguous ? '多候选设备' : '未命中设备'));

  if (ambiguous || (!device && !input.context?.deviceId)) {
    run.status = 'waiting_confirmation';
    run.waitingFor = 'device_selection';
    run.currentNode = 'wait_device_selection';
    run.result = {
      type: 'device_selection_required',
      message: '你想查询哪台设备的保修？',
      candidates: (candidates || listDevices().slice(0, 3)).map((d) => ({
        id: d.id,
        name: d.name,
        brand: d.brand,
        model: d.model,
        category: d.category,
        warrantyStatus: d.warrantyStatus,
      })),
    };
    run.resultType = 'device_selection_required';
    run.nodePath.push(node('wait_device_selection', 'completed', '等待用户选择设备'));
    return;
  }

  const dev = device;
  if (!dev) {
    run.status = 'failed';
    run.errorMessage = '没有找到对应设备。';
    run.result = { type: 'error', error: { code: 'NO_DEVICE', message: run.errorMessage } };
    run.resultType = 'error';
    return;
  }
  run.deviceId = dev.id;

  const ws = calcWarrantyStatus(dev.purchaseDate, dev.warrantyMonths);
  run.nodePath.push(node('calculate_warranty_status', ws.status === 'unknown' ? 'failed' : 'completed', ws.status === 'unknown' ? '缺少购买日期或保修期' : `状态 ${ws.status}`));

  if (ws.status === 'unknown') {
    run.status = 'completed';
    run.result = {
      type: 'warranty_check_result',
      warrantyResult: {
        deviceId: dev.id,
        deviceName: dev.name,
        purchaseDate: dev.purchaseDate,
        warrantyMonths: dev.warrantyMonths,
        status: 'unknown',
      },
      message: '这台设备缺少购买日期或保修期，无法计算保修状态。可以在设备详情里补充信息。',
    };
    run.resultType = 'warranty_check_result';
    run.nodePath.push(node('persist_agent_run', 'completed', '已记录'));
    return;
  }

  run.status = 'completed';
  run.result = {
    type: 'warranty_check_result',
    warrantyResult: {
      deviceId: dev.id,
      deviceName: dev.name,
      purchaseDate: dev.purchaseDate,
      warrantyMonths: dev.warrantyMonths,
      warrantyExpireDate: ws.expireDate,
      status: ws.status,
      daysRemaining: ws.daysRemaining,
    },
  };
  run.resultType = 'warranty_check_result';
  run.nodePath.push(node('persist_agent_run', 'completed', '已记录'));
}

// ---- troubleshooting flow ----
function runTroubleshootingFlow(db: DB, run: AgentRun, input: RunInput) {
  const { device, candidates, ambiguous } = resolveDevice(input.inputText, input.context?.deviceId);
  run.nodePath.push(node('resolve_device_context', 'completed', device ? `命中 ${device.name}` : ambiguous ? '多候选设备' : '未命中设备'));

  // safety_check takes PRIORITY over device selection — even if device is
  // ambiguous or not resolved, high-risk safety content must be blocked first.
  const safety = detectSafetyRisk(input.inputText);
  run.nodePath.push(node('safety_check', 'completed', safety.isHighRisk ? `高风险：${safety.matchedKeywords.join('、')}` : '普通风险'));

  if (safety.isHighRisk) {
    const devId = device?.id || input.context?.deviceId;
    run.deviceId = devId;
    run.status = 'completed';
    run.result = {
      type: 'safety_blocked',
      safetyBlocked: {
        deviceId: devId,
        deviceName: device?.name || '未知设备',
        riskKeywords: safety.matchedKeywords,
        title: SAFETY_TITLE,
        message: SAFETY_MESSAGE,
        guidance: SAFETY_GUIDANCE,
      },
    };
    run.resultType = 'safety_blocked';
    run.nodePath.push(node('render_result', 'completed', '高风险拒答'));
    run.nodePath.push(node('persist_agent_run', 'completed', '已记录'));
    return;
  }

  if (ambiguous || (!device && !input.context?.deviceId)) {
    run.status = 'waiting_confirmation';
    run.waitingFor = 'device_selection';
    run.currentNode = 'wait_device_selection';
    run.result = {
      type: 'device_selection_required',
      message: '你说的是哪台设备出了故障？',
      candidates: (candidates || listDevices().slice(0, 3)).map((d) => ({
        id: d.id,
        name: d.name,
        brand: d.brand,
        model: d.model,
        category: d.category,
        warrantyStatus: d.warrantyStatus,
      })),
    };
    run.resultType = 'device_selection_required';
    run.nodePath.push(node('wait_device_selection', 'completed', '等待用户选择设备'));
    return;
  }

  const dev = device;
  if (!dev) {
    run.status = 'failed';
    run.errorMessage = '没有找到对应设备。';
    run.result = { type: 'error', error: { code: 'NO_DEVICE', message: run.errorMessage } };
    run.resultType = 'error';
    return;
  }
  run.deviceId = dev.id;

  const ws = calcWarrantyStatus(dev.purchaseDate, dev.warrantyMonths);
  run.nodePath.push(node('calculate_warranty_status', 'completed', `状态 ${ws.status}`));
  run.nodePath.push(node('generate_troubleshooting_result', 'completed', '生成排查步骤'));

  const tr = buildTroubleshootingResult(dev, ws.status, input.inputText);
  run.status = 'completed';
  run.result = { type: 'troubleshooting_result', troubleshooting: tr };
  run.resultType = 'troubleshooting_result';
  run.nodePath.push(node('render_result', 'completed', '已生成故障结果'));
  run.nodePath.push(node('persist_agent_run', 'completed', '已记录'));
}

function buildTroubleshootingResult(dev: Device, ws: string, input: string) {
  const symptom = input.replace(/我的|这台|这个|了|怎么办|怎么修|坏了/g, '').trim() || '设备故障';
  let actions: string[] = [];
  let supportMessage = '';
  let materials = ['订单截图', '设备序列号', '故障照片'];
  let safetyAlert: { level: 'warning' | 'danger'; title: string; message: string } | undefined;

  if (/漏水/.test(input)) {
    actions = ['关闭进水阀', '断开电源', '擦干周围水渍', '拍照记录漏水位置'];
    safetyAlert = { level: 'warning', title: '安全提醒', message: '先关闭进水阀并断开电源，再检查漏水位置。' };
    supportMessage = `您好，我的${dev.name}出现漏水，已关闭进水阀并拍照，序列号${dev.serialNumber || '（待补充）'}，请问如何安排上门检测？`;
  } else if (/异响|噪音/.test(input)) {
    actions = ['断开电源', '检查是否有异物卡住', '拍照记录故障现象'];
    safetyAlert = { level: 'warning', title: '安全提醒', message: '检查前请先断开电源，避免带电操作。' };
    supportMessage = `您好，我的${dev.name}运行时有异响，已断电检查未见明显异物，序列号${dev.serialNumber || '（待补充）'}，请问是否需要送修？`;
  } else if (/不制冷|不工作|不开机/.test(input)) {
    actions = ['检查电源是否接通', '检查插座与电源线', '尝试重新通电'];
    supportMessage = `您好，我的${dev.name}无法正常工作，已检查电源仍未恢复，序列号${dev.serialNumber || '（待补充）'}，请协助处理。`;
  } else {
    actions = ['断开电源', '拍照记录故障现象', '保留现场'];
    supportMessage = `您好，我的${dev.name}出现问题：${symptom}，序列号${dev.serialNumber || '（待补充）'}，请协助处理。`;
  }

  return {
    deviceId: dev.id,
    deviceName: dev.name,
    warrantyStatus: ws as Device['warrantyStatus'],
    riskLevel: 'low' as const,
    safetyAlert,
    actions,
    supportMessage,
    materials,
    canSaveRecord: true,
  };
}

// ---------------- Confirm / resume ----------------

export interface ConfirmInput {
  action:
    | 'confirm_device_draft'
    | 'modify_device_draft'
    | 'cancel_device_draft'
    | 'select_device'
    | 'save_fault_record'
    | 'cancel_fault_record';
  deviceId?: string;
  patch?: Record<string, unknown>;
  userId: string;
}

export function confirmAgentRun(runId: string, input: ConfirmInput): AgentRun {
  const db = getDB();
  const run = db.agentRuns.find((r) => r.id === runId);
  if (!run) throw new Error('run not found');
  const now = new Date().toISOString();

  if (input.action === 'cancel_device_draft') {
    run.status = 'cancelled';
    run.nodePath.push(node('apply_user_confirmation', 'completed', '用户取消'));
    run.updatedAt = now;
    upsertAgentRun(db, run);
    saveDB(db);
    return run;
  }

  if (input.action === 'cancel_fault_record') {
    // 取消保存故障记录 → 返回故障结果，不丢失结果内容（DESIGN.md §12.7）
    run.status = 'completed';
    run.waitingFor = undefined;
    run.currentNode = undefined;
    if (run.result?.troubleshooting) {
      run.result = { ...run.result, type: 'troubleshooting_result', faultRecord: undefined };
      run.resultType = 'troubleshooting_result';
    }
    run.nodePath.push(node('wait_save_record_confirmation', 'skipped', '用户取消保存'));
    run.updatedAt = now;
    upsertAgentRun(db, run);
    saveDB(db);
    return run;
  }

  if (input.action === 'modify_device_draft') {
    const draft = run.result?.deviceDraft;
    if (draft) {
      Object.assign(draft, input.patch || {});
      draft.status = 'modified';
      run.result = { ...run.result, type: 'device_draft', deviceDraft: draft } as AgentResult;
    }
    run.nodePath.push(node('apply_user_confirmation', 'completed', '用户修改草稿'));
    run.updatedAt = now;
    upsertAgentRun(db, run);
    saveDB(db);
    return run;
  }

  if (input.action === 'confirm_device_draft') {
    return applyConfirmDeviceDraft(db, run, input);
  }

  if (input.action === 'select_device') {
    return applySelectDevice(db, run, input);
  }

  if (input.action === 'save_fault_record') {
    return applySaveFaultRecord(db, run, input);
  }

  return run;
}

function applyConfirmDeviceDraft(db: DB, run: AgentRun, input: ConfirmInput): AgentRun {
  const draft = run.result?.deviceDraft;
  if (!draft) {
    run.status = 'failed';
    run.errorMessage = '草稿不存在';
    run.nodePath.push(node('apply_user_confirmation', 'failed', '草稿不存在'));
    upsertAgentRun(db, run);
    saveDB(db);
    return run;
  }
  if (input.patch) Object.assign(draft, input.patch);
  run.status = 'running';
  run.nodePath.push(node('apply_user_confirmation', 'completed', '用户已确认'));

  // create_device
  const device = createDevice(
    {
      name: draft.name,
      brand: draft.brand,
      model: draft.model,
      category: draft.category,
      purchaseDate: draft.purchaseDate,
      warrantyMonths: draft.warrantyMonths,
      serialNumber: draft.serialNumber,
      purchaseChannel: draft.purchaseChannel,
    },
    input.userId,
  );
  run.nodePath.push(node('create_device', 'completed', `已创建设备 ${device.id}`));
  // attach files
  bindAttachmentsToDevice(draft.sourceAttachmentIds, device.id);
  run.nodePath.push(node('attach_files_to_device', 'completed', `绑定 ${draft.sourceAttachmentIds.length} 个附件`));
  // create warranty reminder
  let reminder: Reminder | undefined;
  if (draft.suggestedReminders[0] && device.warrantyExpireDate) {
    reminder = createReminder(
      {
        deviceId: device.id,
        type: 'warranty_expire',
        title: draft.suggestedReminders[0].title,
        dueDate: draft.suggestedReminders[0].dueDate,
        description: `保修将于 ${device.warrantyExpireDate} 到期`,
        sourceAgentRunId: run.id,
      },
      input.userId,
    );
    run.nodePath.push(node('create_warranty_reminder', 'completed', '已创建保修提醒'));
  } else {
    run.nodePath.push(node('create_warranty_reminder', 'skipped', '无保修截止日'));
  }
  // index manual if exists (mock: 把上传的 manual 附件登记为 manualChunks 的一条 chunk)
  const manualAtt = (draft.sourceAttachmentIds || [])
    .map((id) => db.attachments.find((a) => a.id === id))
    .find((a) => a && a.attachmentType === 'manual');
  if (manualAtt) {
    db.manualChunks.push({
      deviceId: device.id,
      attachmentId: manualAtt.id,
      chunkIndex: 0,
      pageNumber: 1,
      section: '使用说明',
      content: `${device.name} 使用说明：请按说明书指引安装与使用，定期清洁保养。如有异常请先断电并联系官方售后。`,
    });
    run.nodePath.push(node('index_manual_if_exists', 'completed', '已索引说明书'));
  } else {
    run.nodePath.push(node('index_manual_if_exists', 'skipped', '无说明书'));
  }

  run.status = 'completed';
  run.deviceId = device.id;
  const attachments = draft.sourceAttachmentIds
    .map((id) => db.attachments.find((a) => a.id === id))
    .filter(Boolean) as Attachment[];
  run.result = {
    type: 'device_create_success',
    device,
    attachments,
    reminder,
    message: `已创建设备「${device.name}」，绑定 ${attachments.length} 个附件，并生成保修提醒。`,
  };
  run.resultType = 'device_create_success';
  run.nodePath.push(node('final_response', 'completed', '建档完成'));
  run.updatedAt = new Date().toISOString();
  upsertAgentRun(db, run);
  saveDB(db);
  return run;
}

function applySelectDevice(db: DB, run: AgentRun, input: ConfirmInput): AgentRun {
  const devId = input.deviceId;
  if (!devId) {
    run.status = 'failed';
    run.errorMessage = '未选择设备';
    upsertAgentRun(db, run);
    saveDB(db);
    return run;
  }
  run.context = { ...run.context, deviceId: devId };
  run.deviceId = devId;
  run.nodePath.push(node('apply_user_confirmation', 'completed', `用户选择设备 ${devId}`));
  // 重新执行对应分支
  const reInput: RunInput = {
    inputText: run.userInput,
    intentHint: run.intent,
    attachmentIds: run.attachmentIds,
    context: { deviceId: devId, source: run.context?.source },
    userId: input.userId,
  };
  if (run.intent === 'manual_qa') runManualQaFlow(db, run, reInput);
  else if (run.intent === 'warranty_check') runWarrantyFlow(db, run, reInput);
  else if (run.intent === 'troubleshooting') runTroubleshootingFlow(db, run, reInput);
  run.updatedAt = new Date().toISOString();
  upsertAgentRun(db, run);
  saveDB(db);
  return run;
}

function applySaveFaultRecord(db: DB, run: AgentRun, input: ConfirmInput): AgentRun {
  const tr = run.result?.troubleshooting;
  if (!tr) {
    run.status = 'failed';
    run.errorMessage = '没有可保存的故障结果';
    upsertAgentRun(db, run);
    saveDB(db);
    return run;
  }
  const fr = createFaultRecord(
    {
      deviceId: tr.deviceId,
      agentRunId: run.id,
      type: 'troubleshooting',
      title: `${tr.deviceName} 故障记录`,
      symptom: run.userInput,
      riskLevel: tr.riskLevel,
      summary: tr.actions.join('；'),
      serviceScript: tr.supportMessage,
    },
    input.userId,
  );
  run.status = 'completed';
  run.result = { ...run.result, type: 'fault_record_saved', faultRecord: fr };
  run.resultType = 'fault_record_saved';
  run.nodePath.push(node('save_maintenance_record', 'completed', '已保存故障记录'));
  run.updatedAt = new Date().toISOString();
  upsertAgentRun(db, run);
  saveDB(db);
  return run;
}

// 生成保存故障记录确认态（不直接写入）
export function requestSaveFaultRecordConfirmation(runId: string): AgentRun {
  const db = getDB();
  const run = db.agentRuns.find((r) => r.id === runId);
  if (!run) throw new Error('run not found');
  const tr = run.result?.troubleshooting;
  if (!tr) return run;
  run.status = 'waiting_confirmation';
  run.waitingFor = 'save_fault_record_confirmation';
  run.currentNode = 'wait_save_record_confirmation';
  run.result = {
    ...run.result,
    type: 'save_fault_record_confirmation',
    faultRecord: {
      id: 'pending',
      householdId: 'household_default',
      deviceId: tr.deviceId,
      agentRunId: run.id,
      type: 'troubleshooting',
      title: `${tr.deviceName} 故障记录`,
      symptom: run.userInput,
      riskLevel: tr.riskLevel,
      summary: tr.actions.join('；'),
      serviceScript: tr.supportMessage,
      occurredAt: new Date().toISOString(),
      createdByUserId: run.createdByUserId,
      createdAt: new Date().toISOString(),
    },
  };
  run.resultType = 'save_fault_record_confirmation';
  run.nodePath.push(node('wait_save_record_confirmation', 'completed', '等待用户确认保存'));
  run.updatedAt = new Date().toISOString();
  upsertAgentRun(db, run);
  saveDB(db);
  return run;
}

// ---------------- Settings ----------------

export function getSettings(userId: string): Settings {
  return {
    userId,
    defaultReminderTime: '09:00',
    categoryOrder: ['厨房设备', '清洁设备', '生活电器', '其他'],
    exportAvailable: true,
  };
}

// ---------------- Reset ----------------

export function resetDemoData(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(DB_KEY);
  getDB();
}

export function exportData(): string {
  const db = getDB();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      household: HOUSEHOLD,
      devices: db.devices,
      attachments: db.attachments,
      reminders: db.reminders,
      faultRecords: db.faultRecords,
      agentRuns: db.agentRuns,
    },
    null,
    2,
  );
}

// 用于前端类型推断的 re-export
export type { AgentResult, User };
