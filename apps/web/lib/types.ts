// HomeCare Agent v0.1 — shared domain types
// Aligned with EXECUTION_PLAN §7 (data models) and §9.4 (Agent result payloads).

export type HouseholdId = 'household_default';

export interface User {
  id: 'user_home_a' | 'user_home_b';
  username: 'home_a' | 'home_b';
  displayName: string;
  householdId: HouseholdId;
}

export interface Household {
  id: HouseholdId;
  name: string;
}

export interface Session {
  userId: User['id'];
  username: User['username'];
  displayName: string;
  householdId: HouseholdId;
  householdName: string;
  token: string;
}

export type WarrantyStatus = 'active' | 'expiring' | 'expired' | 'unknown';

export interface Device {
  id: string;
  householdId: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  purchaseDate?: string; // ISO date yyyy-mm-dd
  warrantyMonths?: number;
  warrantyExpireDate?: string; // ISO date yyyy-mm-dd
  warrantyStatus: WarrantyStatus;
  serialNumber?: string;
  purchaseChannel?: string;
  servicePhone?: string;
  notes?: string;
  createdByUserId: string;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type AttachmentType =
  | 'order_screenshot'
  | 'invoice'
  | 'manual'
  | 'warranty_card'
  | 'device_photo'
  | 'repair_receipt'
  | 'other';

export type ParseStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'parsing'
  | 'parsed'
  | 'failed';

export interface Attachment {
  id: string;
  householdId: string;
  deviceId?: string;
  agentRunId?: string;
  filename: string;
  mimeType: string;
  fileType: 'image' | 'pdf' | 'other';
  attachmentType: AttachmentType;
  sizeBytes?: number;
  url?: string;
  parseStatus: ParseStatus;
  parseSummary?: string;
  parseError?: string;
  createdByUserId: string;
  createdAt: string;
}

export type ReminderType =
  | 'warranty_expire'
  | 'maintenance'
  | 'filter_replace'
  | 'custom';

export type ReminderStatus = 'pending' | 'done' | 'ignored';

export interface Reminder {
  id: string;
  householdId: string;
  deviceId?: string;
  type: ReminderType;
  title: string;
  description?: string;
  dueDate: string; // ISO date
  status: ReminderStatus;
  source?: string;
  sourceAgentRunId?: string;
  createdByUserId: string;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type FaultRiskLevel = 'low' | 'medium' | 'high';

export interface FaultRecord {
  id: string;
  householdId: string;
  deviceId: string;
  agentRunId?: string;
  type: 'troubleshooting' | 'repair' | 'maintenance' | 'other';
  title: string;
  symptom: string;
  riskLevel: FaultRiskLevel;
  summary: string;
  serviceScript?: string;
  occurredAt: string;
  createdByUserId: string;
  createdAt: string;
}

export type AgentIntent =
  | 'create_device'
  | 'manual_qa'
  | 'warranty_check'
  | 'troubleshooting'
  | 'unknown';

export type AgentRunStatus =
  | 'running'
  | 'waiting_confirmation'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentRunNodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface AgentRunNode {
  name: string;
  status: AgentRunNodeStatus;
  startedAt?: string;
  endedAt?: string;
  summary?: string;
}

export type AgentResultType =
  | 'device_draft'
  | 'device_create_success'
  | 'device_selection_required'
  | 'manual_answer'
  | 'manual_no_source'
  | 'warranty_check_result'
  | 'troubleshooting_result'
  | 'safety_blocked'
  | 'save_fault_record_confirmation'
  | 'fault_record_saved'
  | 'error';

export interface DeviceDraft {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  purchaseDate?: string;
  warrantyMonths?: number;
  warrantyExpireDate?: string;
  serialNumber?: string;
  purchaseChannel?: string;
  servicePhone?: string;
  confidence: number;
  missingFields: string[];
  sourceAttachmentIds: string[];
  suggestedReminders: {
    type: ReminderType;
    title: string;
    dueDate: string;
  }[];
  status: 'pending_confirmation' | 'modified' | 'confirmed' | 'cancelled';
}

export interface ManualSource {
  attachmentId: string;
  fileName: string;
  pageNumber?: number;
  section?: string;
  snippet: string;
}

export interface ManualAnswer {
  summary: string;
  steps?: string[];
  sources: ManualSource[];
}

export interface WarrantyResult {
  deviceId: string;
  deviceName: string;
  purchaseDate?: string;
  warrantyMonths?: number;
  warrantyExpireDate?: string;
  status: WarrantyStatus;
  daysRemaining?: number;
}

export interface TroubleshootingResult {
  deviceId: string;
  deviceName: string;
  warrantyStatus: WarrantyStatus;
  riskLevel: FaultRiskLevel;
  safetyAlert?: {
    level: 'warning' | 'danger';
    title: string;
    message: string;
  };
  actions: string[];
  supportMessage: string;
  materials: string[];
  canSaveRecord: boolean;
}

export interface SafetyBlockedResult {
  deviceId?: string;
  deviceName?: string;
  riskKeywords: string[];
  title: string;
  message: string;
  guidance: string[];
}

export interface AgentResult {
  type: AgentResultType;
  message?: string;
  deviceDraft?: DeviceDraft;
  device?: Device;
  attachments?: Attachment[];
  reminder?: Reminder;
  candidates?: {
    id: string;
    name: string;
    brand?: string;
    model?: string;
    category?: string;
    warrantyStatus: WarrantyStatus;
  }[];
  manualAnswer?: ManualAnswer;
  manualNoSourceReason?: 'no_manual' | 'answer_not_found';
  warrantyResult?: WarrantyResult;
  troubleshooting?: TroubleshootingResult;
  safetyBlocked?: SafetyBlockedResult;
  faultRecord?: FaultRecord;
  error?: { code: string; message: string };
}

export interface AgentRun {
  id: string;
  householdId: string;
  createdByUserId: string;
  intent: AgentIntent;
  userInput: string;
  status: AgentRunStatus;
  deviceId?: string;
  currentNode?: string;
  waitingFor?: string;
  resultType?: AgentResultType;
  result?: AgentResult;
  nodePath: AgentRunNode[];
  errorMessage?: string;
  attachmentIds?: string[];
  context?: { deviceId?: string; source?: string };
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  userId: string;
  defaultReminderTime: string; // HH:mm
  categoryOrder: string[];
  exportAvailable: boolean;
}

// 说明书 mock chunks（v0.1 用 seed chunks 替代向量检索）
export interface ManualChunkSeed {
  deviceId: string;
  attachmentId: string;
  chunkIndex: number;
  pageNumber?: number;
  section?: string;
  content: string;
}
