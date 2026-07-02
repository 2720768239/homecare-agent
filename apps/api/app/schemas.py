"""Pydantic models aligned with frontend types.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional, Union

from pydantic import BaseModel, Field


# ── Literal types ──────────────────────────────────────────────────────────

WarrantyStatus = Literal["active", "expiring", "expired", "unknown"]
AttachmentType = Literal[
    "order_screenshot", "invoice", "manual",
    "warranty_card", "device_photo", "repair_receipt", "other",
]
ParseStatus = Literal["pending", "uploading", "uploaded", "parsing", "parsed", "failed"]
FileType = Literal["image", "pdf", "other"]
ReminderType = Literal["warranty_expire", "maintenance", "filter_replace", "custom"]
ReminderStatus = Literal["pending", "done", "ignored"]
FaultRiskLevel = Literal["low", "medium", "high"]
AgentIntent = Literal["create_device", "manual_qa", "warranty_check", "troubleshooting", "unknown"]
AgentRunStatus = Literal["running", "waiting_confirmation", "completed", "failed", "cancelled"]
AgentRunNodeStatus = Literal["pending", "running", "completed", "failed", "skipped"]
AgentResultType = Literal[
    "device_draft", "device_create_success", "device_selection_required",
    "manual_answer", "manual_no_source", "warranty_check_result",
    "troubleshooting_result", "safety_blocked",
    "save_fault_record_confirmation", "fault_record_saved", "error",
]
DeviceDraftStatus = Literal["pending_confirmation", "modified", "confirmed", "cancelled"]


# ── Domain models ──────────────────────────────────────────────────────────

class User(BaseModel):
    id: str
    username: str
    displayName: str
    householdId: str


class Household(BaseModel):
    id: str
    name: str


class Session(BaseModel):
    userId: str
    username: str
    displayName: str
    householdId: str
    householdName: str
    token: str


class Device(BaseModel):
    id: str
    householdId: str
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    category: str
    purchaseDate: Optional[str] = None
    warrantyMonths: Optional[int] = None
    warrantyExpireDate: Optional[str] = None
    warrantyStatus: WarrantyStatus = "unknown"
    serialNumber: Optional[str] = None
    purchaseChannel: Optional[str] = None
    servicePhone: Optional[str] = None
    notes: Optional[str] = None
    createdByUserId: str
    updatedByUserId: Optional[str] = None
    createdAt: str
    updatedAt: str


class Attachment(BaseModel):
    id: str
    householdId: str
    deviceId: Optional[str] = None
    agentRunId: Optional[str] = None
    filename: str
    mimeType: str
    fileType: FileType
    attachmentType: AttachmentType
    sizeBytes: Optional[int] = None
    url: Optional[str] = None
    parseStatus: ParseStatus
    parseSummary: Optional[str] = None
    parseError: Optional[str] = None
    createdByUserId: str
    createdAt: str


class Reminder(BaseModel):
    id: str
    householdId: str
    deviceId: Optional[str] = None
    type: ReminderType
    title: str
    description: Optional[str] = None
    dueDate: str
    status: ReminderStatus
    source: Optional[str] = None
    sourceAgentRunId: Optional[str] = None
    createdByUserId: str
    updatedByUserId: Optional[str] = None
    createdAt: str
    updatedAt: str


class FaultRecord(BaseModel):
    id: str
    householdId: str
    deviceId: str
    agentRunId: Optional[str] = None
    type: Literal["troubleshooting", "repair", "maintenance", "other"]
    title: str
    symptom: str
    riskLevel: FaultRiskLevel
    summary: str
    serviceScript: Optional[str] = None
    occurredAt: str
    createdByUserId: str
    createdAt: str


# ── Agent result sub-models ────────────────────────────────────────────────

class DeviceDraftField(BaseModel):
    """A single field in a device draft for user editing."""
    key: str
    label: str
    value: Any = None
    confidence: float = 0.0


class DeviceDraft(BaseModel):
    id: str
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    category: str
    purchaseDate: Optional[str] = None
    warrantyMonths: Optional[int] = None
    warrantyExpireDate: Optional[str] = None
    serialNumber: Optional[str] = None
    purchaseChannel: Optional[str] = None
    confidence: float = 0.0
    missingFields: List[str] = Field(default_factory=list)
    sourceAttachmentIds: List[str] = Field(default_factory=list)
    suggestedReminders: List[dict] = Field(default_factory=list)
    status: DeviceDraftStatus = "pending_confirmation"


class ManualSource(BaseModel):
    attachmentId: str
    fileName: str
    pageNumber: Optional[int] = None
    section: Optional[str] = None
    snippet: str


class ManualAnswer(BaseModel):
    summary: str
    steps: Optional[List[str]] = None
    sources: List[ManualSource] = Field(default_factory=list)


class WarrantyResult(BaseModel):
    deviceId: str
    deviceName: str
    purchaseDate: Optional[str] = None
    warrantyMonths: Optional[int] = None
    warrantyExpireDate: Optional[str] = None
    status: WarrantyStatus = "unknown"
    daysRemaining: Optional[int] = None


class SafetyAlert(BaseModel):
    level: Literal["warning", "danger"]
    title: str
    message: str


class TroubleshootingResult(BaseModel):
    deviceId: str
    deviceName: str
    warrantyStatus: WarrantyStatus
    riskLevel: FaultRiskLevel
    safetyAlert: Optional[SafetyAlert] = None
    actions: List[str] = Field(default_factory=list)
    supportMessage: str = ""
    materials: List[str] = Field(default_factory=list)
    canSaveRecord: bool = True


class SafetyBlockedResult(BaseModel):
    deviceId: Optional[str] = None
    deviceName: Optional[str] = None
    riskKeywords: List[str] = Field(default_factory=list)
    title: str = ""
    message: str = ""
    guidance: List[str] = Field(default_factory=list)


class DeviceCandidate(BaseModel):
    id: str
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    category: Optional[str] = None
    warrantyStatus: WarrantyStatus = "unknown"


class AgentResultError(BaseModel):
    code: str
    message: str


class AgentResult(BaseModel):
    """Discriminated union by type field — aligned with frontend AgentResult."""
    type: AgentResultType
    message: Optional[str] = None
    deviceDraft: Optional[DeviceDraft] = None
    device: Optional[Device] = None
    attachments: Optional[List[Attachment]] = None
    reminder: Optional[Reminder] = None
    candidates: Optional[List[DeviceCandidate]] = None
    manualAnswer: Optional[ManualAnswer] = None
    manualNoSourceReason: Optional[Literal["no_manual", "answer_not_found"]] = None
    warrantyResult: Optional[WarrantyResult] = None
    troubleshooting: Optional[TroubleshootingResult] = None
    safetyBlocked: Optional[SafetyBlockedResult] = None
    faultRecord: Optional[FaultRecord] = None
    error: Optional[AgentResultError] = None


class AgentRunNode(BaseModel):
    name: str
    status: AgentRunNodeStatus
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    summary: Optional[str] = None


class AgentRun(BaseModel):
    id: str
    householdId: str
    createdByUserId: str
    intent: AgentIntent
    userInput: str
    status: AgentRunStatus
    deviceId: Optional[str] = None
    currentNode: Optional[str] = None
    waitingFor: Optional[str] = None
    resultType: Optional[AgentResultType] = None
    result: Optional[AgentResult] = None
    nodePath: List[AgentRunNode] = Field(default_factory=list)
    errorMessage: Optional[str] = None
    attachmentIds: Optional[List[str]] = None
    context: Optional[dict] = None
    createdAt: str
    updatedAt: str


class SettingsModel(BaseModel):
    userId: str
    defaultReminderTime: str = "09:00"
    categoryOrder: List[str] = Field(
        default_factory=lambda: ["厨房设备", "清洁设备", "生活电器", "其他"]
    )
    exportAvailable: bool = True


# ── Request / Response models ──────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    user: Session
    token: str


class StartRunRequest(BaseModel):
    inputText: str
    intentHint: Optional[AgentIntent] = None
    attachmentIds: Optional[List[str]] = None
    context: Optional[dict] = None
    userId: str = "user_home_a"


class ConfirmRunRequest(BaseModel):
    action: Literal[
        "confirm_device_draft", "modify_device_draft", "cancel_device_draft",
        "select_device", "save_fault_record", "cancel_fault_record",
    ]
    deviceId: Optional[str] = None
    patch: Optional[dict] = None
    userId: str = "user_home_a"


class CreateDeviceRequest(BaseModel):
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    category: str = "未分类"
    purchaseDate: Optional[str] = None
    warrantyMonths: Optional[int] = None
    serialNumber: Optional[str] = None
    purchaseChannel: Optional[str] = None
    servicePhone: Optional[str] = None
    notes: Optional[str] = None


class PatchDeviceRequest(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    category: Optional[str] = None
    purchaseDate: Optional[str] = None
    warrantyMonths: Optional[int] = None
    serialNumber: Optional[str] = None
    purchaseChannel: Optional[str] = None
    servicePhone: Optional[str] = None
    notes: Optional[str] = None


class RegisterAttachmentRequest(BaseModel):
    filename: str
    mimeType: str
    sizeBytes: Optional[int] = None
    attachmentType: Optional[AttachmentType] = None


class UpdateParseStatusRequest(BaseModel):
    parseStatus: ParseStatus
    parseError: Optional[str] = None


class PatchReminderRequest(BaseModel):
    status: Optional[ReminderStatus] = None
