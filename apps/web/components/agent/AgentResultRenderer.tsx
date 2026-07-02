'use client';

// 根据 run.resultType / run.result.type 分发渲染对应的结构化结果卡片。
// 不把结果做成纯文本，保证 Agent 结果可解释、可操作（TECH_SPEC §5.7）。

import type { AgentRun, AgentResultType } from '@/lib/types';
import {
  DeviceDraftCard,
  DeviceCreateSuccessCard,
  DeviceSelectionCard,
  ManualAnswerCard,
  ManualNoSourceCard,
  WarrantyResultCard,
  TroubleshootingResultCard,
  HighRiskSafetyCard,
  SaveFaultRecordConfirmation,
  FaultRecordSavedCard,
  ErrorCard,
} from './cards';

const RENDERERS: Partial<Record<AgentResultType, (run: AgentRun) => React.ReactNode>> = {
  device_draft: (run) => <DeviceDraftCard run={run} />,
  device_create_success: (run) => <DeviceCreateSuccessCard run={run} />,
  device_selection_required: (run) => <DeviceSelectionCard run={run} />,
  manual_answer: (run) => <ManualAnswerCard run={run} />,
  manual_no_source: (run) => <ManualNoSourceCard run={run} />,
  warranty_check_result: (run) => <WarrantyResultCard run={run} />,
  troubleshooting_result: (run) => <TroubleshootingResultCard run={run} />,
  safety_blocked: (run) => <HighRiskSafetyCard run={run} />,
  save_fault_record_confirmation: (run) => <SaveFaultRecordConfirmation run={run} />,
  fault_record_saved: (run) => <FaultRecordSavedCard run={run} />,
  error: (run) => <ErrorCard run={run} />,
};

export function AgentResultRenderer({ run }: { run: AgentRun }) {
  const type = run.resultType || run.result?.type;
  if (!type) return null;
  const render = RENDERERS[type];
  if (!render) return null;
  return <>{render(run)}</>;
}
