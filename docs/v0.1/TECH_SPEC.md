# HomeCare Agent v0.1 TECH_SPEC.md

版本：v0.1-tech-spec  
文档类型：技术方案 / Technical Specification  
项目阶段：技术方案定稿 / 编码前  
产品形态：移动端 PWA / 移动端 H5  
核心技术方向：Next.js PWA + Python FastAPI + LangGraph + PostgreSQL + S3/MinIO  
最后更新：2026-06-29

---

## 1. 技术方案结论

HomeCare Agent v0.1 采用以下技术栈：

```text
前端：Next.js PWA / 移动端 H5
后端：Python FastAPI
Agent 工作流：LangGraph
数据库：PostgreSQL + pgvector
文件存储：S3 / MinIO
AI 能力：OpenAI API + Structured Outputs + Vision / File Input + Embeddings
```

本技术方案服务于 HomeCare Agent v0.1 的移动端 Agent-first MVP：

```text
打开应用
↓
Auth Checking
↓
账号名 + 密码登录
↓
进入同一个家庭空间 household_default
↓
打开 Agent 主界面
↓
手机拍照 / 上传资料 / 输入描述
↓
HomeCare Agent 生成设备草稿
↓
用户确认
↓
创建设备
↓
绑定附件
↓
创建保修提醒
↓
索引说明书
↓
进入设备详情
↓
问说明书 / 故障售后
```

v0.1 不做 PC 端、不做桌面端管理台、不做传统底部五 Tab 导航、不做账号注册、不做忘记密码、不做多家庭切换、不做家庭成员邀请、不做角色权限、不做系统级推送、不做自动联系售后、不做自动购买耗材。

---

## 2. 技术选型

### 2.1 前端选型

```text
Next.js PWA / 移动端 H5
TypeScript
React
Tailwind CSS
Zustand
TanStack Query
React Hook Form
Zod
```

选择原因：

1. v0.1 需要快速验证移动端 Agent-first 产品闭环。
2. Next.js PWA 能快速实现移动端 H5、PWA manifest、路由、页面和组件体系。
3. H5 能满足 v0.1 的拍照上传、相册选择、PDF 文件上传、Agent 对话流、左侧抽屉、底部 Composer、底部弹窗等核心体验。
4. 相比原生 App，Next.js PWA 更适合快速开发、快速部署、快速被 Codex / Cursor 接手。
5. 后续如果移动端原生体验要求提高，可以迁移到 Expo React Native，后端和 Agent 架构不需要大改。

前端实现重点：

```text
Login / Auth Checking / Auth Guard / Logout
Agent-first 主界面
ChatGPT-like 左侧抽屉
底部 Composer
文件上传卡片
Agent 状态流
设备草稿确认卡片
结构化结果卡
执行过程底部弹窗
设备库 / 设备详情 / 提醒 / 执行记录
```

---

### 2.2 后端选型

```text
Python
FastAPI
Pydantic
SQLAlchemy / SQLModel
Alembic
```

选择原因：

1. Python 生态更适合 LangGraph、文件解析、PDF 处理、RAG、OCR / 视觉模型调用。
2. FastAPI 与 Pydantic 适合定义清晰的 API 合同和结构化数据。
3. 后续可以基于 FastAPI OpenAPI 自动生成前端 TypeScript 类型。
4. v0.1 不需要微服务，一个 FastAPI 服务即可承载业务 API、AgentRun API、文件上传签名、设备 API 和 LangGraph 调用。

---

### 2.3 Agent 工作流选型

```text
LangGraph
```

选择原因：

1. HomeCare Agent 的核心不是普通聊天，而是可暂停、可确认、可恢复的工作流。
2. 自动建档流程需要：生成设备草稿 → interrupt 等待用户确认 → resume 后写入设备。
3. LangGraph 适合实现 human-in-the-loop、状态持久化、节点执行记录、失败恢复和任务历史。
4. LangGraph 节点可以直接映射到前端 UI 状态和执行过程展示。

---

### 2.4 数据库选型

```text
PostgreSQL
pgvector
```

选择原因：

1. PostgreSQL 负责设备、附件元数据、提醒、维修记录、AgentRun、AgentRunStep 等结构化数据。
2. pgvector 负责说明书 chunks 的 embedding 检索。
3. v0.1 不需要引入独立向量数据库。
4. 后续数据量增长后，可为 manual_chunks 增加 HNSW / IVFFlat 索引。

---

### 2.5 文件存储选型

```text
开发环境：MinIO
生产环境：S3 兼容对象存储
```

可选生产实现：

```text
AWS S3
Cloudflare R2
阿里云 OSS
腾讯云 COS
自托管 MinIO
```

原则：

1. 图片、PDF、发票、保修卡、说明书、维修单不存入数据库。
2. PostgreSQL 只保存附件元数据和 storage key。
3. 前端通过后端签发的 presigned URL 直传 S3 / MinIO。
4. 文件上传成功不等于设备创建成功。
5. 只有用户确认设备草稿后，附件才绑定到正式设备。

---

## 3. 总体架构

```text
Mobile Browser / PWA
        ↓
Next.js Web App
        ↓
FastAPI Backend
        ↓
LangGraph Agent Workflow
        ↓
PostgreSQL + pgvector
        ↓
S3 / MinIO Object Storage
        ↓
OpenAI API
```

### 3.1 运行时职责

| 模块 | 职责 |
|---|---|
| Next.js PWA | 移动端 UI、Agent 主界面、文件上传、状态展示、确认卡片、设备库、设备详情 |
| FastAPI | API 网关、认证上下文、业务服务、文件上传签名、AgentRun 创建 / 查询 / resume |
| LangGraph | 意图识别、文件解析、设备草稿生成、等待确认、确认后写入、说明书问答、故障售后 |
| PostgreSQL | 结构化业务数据、Agent 执行记录、说明书 chunk 元数据 |
| pgvector | 说明书 embedding 检索 |
| S3 / MinIO | 图片、PDF、附件、解析结果文件 |
| OpenAI API | 多模态提取、结构化输出、说明书问答、故障售后文案生成、embedding |

---

## 4. 工程目录结构

建议采用 Monorepo：

```text
homecare-agent/
├── apps/
│   ├── web/              # Next.js PWA / 移动端 H5
│   └── api/              # FastAPI + LangGraph
│
├── infra/                # 本地开发与基础设施
│   ├── docker-compose.yml
│   ├── postgres/
│   ├── minio/
│   └── migrations/
│
├── docs/
│   ├── prd.md
│   ├── DESIGN.md
│   ├── HomeCare_Agent_TEST_CASES.md
│   └── TECH_SPEC.md
│
├── scripts/
│   ├── setup-dev.sh
│   ├── reset-db.sh
│   ├── seed-demo-data.py
│   ├── create-minio-buckets.sh
│   ├── run-api-tests.sh
│   └── run-web-tests.sh
│
├── .env.example
├── README.md
└── TODO.md
```

---

## 5. 前端架构

### 5.1 路由设计

```text
/                     Agent 主界面
/devices              设备库
/devices/[id]         设备详情
/reminders            提醒
/runs                 Agent 执行记录
/runs/[id]            执行记录详情
/settings             设置
/about                关于
```

### 5.2 apps/web 目录建议

```text
apps/web/
├── app/
│   ├── page.tsx
│   ├── devices/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── reminders/page.tsx
│   ├── runs/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── settings/page.tsx
│   └── layout.tsx
│
├── components/
│   ├── app-shell/
│   │   ├── AppShell.tsx
│   │   ├── TopBar.tsx
│   │   ├── SideDrawer.tsx
│   │   └── BottomComposer.tsx
│   │
│   ├── agent/
│   │   ├── AgentConversation.tsx
│   │   ├── AgentQuickActions.tsx
│   │   ├── AgentStatusMessage.tsx
│   │   ├── AgentExecutionSheet.tsx
│   │   └── AgentResultRenderer.tsx
│   │
│   ├── upload/
│   │   ├── UploadActionSheet.tsx
│   │   ├── UploadedFileCard.tsx
│   │   └── FileParseStatus.tsx
│   │
│   ├── device/
│   │   ├── DeviceDraftCard.tsx
│   │   ├── DeviceDraftEditSheet.tsx
│   │   ├── DeviceCreateSuccessCard.tsx
│   │   ├── DeviceListItem.tsx
│   │   ├── DeviceHeader.tsx
│   │   └── WarrantyBadge.tsx
│   │
│   ├── manual/
│   │   └── ManualAnswerCard.tsx
│   │
│   ├── troubleshooting/
│   │   ├── TroubleshootingResultCard.tsx
│   │   ├── SafetyAlertCard.tsx
│   │   └── SupportMessageCard.tsx
│   │
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── BottomSheet.tsx
│       ├── ConfirmDialog.tsx
│       └── Badge.tsx
│
├── lib/
│   ├── api-client.ts
│   ├── query-client.ts
│   ├── upload.ts
│   ├── warranty.ts
│   └── constants.ts
│
├── stores/
│   ├── agent-store.ts
│   ├── composer-store.ts
│   └── drawer-store.ts
│
├── types/
│   ├── agent.ts
│   ├── device.ts
│   ├── attachment.ts
│   └── api.ts
│
├── public/
│   ├── manifest.json
│   └── icons/
│
└── package.json
```

### 5.3 前端状态管理

| 状态 | 工具 | 说明 |
|---|---|---|
| Server state | TanStack Query | devices、agent_runs、reminders、attachments |
| UI state | Zustand | 抽屉开关、Composer 状态、当前上传文件、底部弹窗 |
| Form state | React Hook Form + Zod | 设备草稿修改、设备编辑、提醒创建 |
| API types | OpenAPI generated types | 从 FastAPI OpenAPI 自动生成 |

### 5.4 Agent 主界面状态

```text
idle
input_ready
uploading
running
needs_confirmation
applying_action
completed
failed
cancelled
```

前端渲染规则：

| run.status | UI 表现 |
|---|---|
| running | AgentStatusMessage，展示当前节点文案 |
| needs_confirmation | 根据 waiting_for 渲染确认卡片 |
| applying_action | 展示正在保存 / 正在创建设备 |
| completed | 渲染结构化结果卡 |
| failed | ErrorCard + 恢复操作 |
| cancelled | 展示已取消状态 |

### 5.5 关键中间态组件补齐

v0.1 编码前必须补齐以下前端组件，避免 Agent 主流程只覆盖 happy path：

| 组件 | 触发场景 | 作用 |
|---|---|---|
| SideDrawer | 点击顶部菜单 | 承载新任务、设备库、提醒、执行记录、设置、关于等低频入口；不承载数据导出独立入口 |
| UploadActionSheet | 点击 Composer `+` | 提供拍照、相册、上传文件、手动添加设备 |
| UploadedFileCard | 选择文件后 | 展示待上传、上传中、已上传、解析中、已解析、解析失败 |
| DeviceSelectionCard / Sheet | 多候选设备 | 让用户选择设备，避免 Agent 猜测 |
| AgentExecutionSheet | 点击执行过程 | 展示节点路径和节点状态 |
| AgentRunList | 点击抽屉的 Agent 执行记录 | 展示任务标题、输入摘要、意图、状态、节点数和创建时间 |
| DeviceDraftEditSheet | 点击修改信息 | 编辑设备名称、品牌、型号、分类、购买日期、保修期等草稿字段 |
| DeviceCreateSuccessCard | 确认创建设备后 | 展示建档完成结果、绑定附件、提醒和说明书索引摘要 |
| ManualAnswerCard | 说明书问答命中答案 | 展示结构化回答、步骤和来源入口 |
| ManualEmptyStateCard | 无说明书 / 未检索到答案 | 阻止说明书问答编造 |
| ManualSourceSheet | 点击来源 | 展示来源附件、页码、片段 |
| WarrantyResultCard | 保修查询完成 | 展示保修状态、截止日期、剩余天数和提醒状态 |
| SaveMaintenanceRecordConfirmCard | 点击保存故障记录 | 确认后才写入 MaintenanceRecord |

### 5.6 路由返回规则

| 来源 | 目标 | 返回行为 |
|---|---|---|
| Agent 主界面点击查看设备 | `/devices/[id]` | 返回 Agent 任务结果 |
| 设备库点击设备 | `/devices/[id]` | 返回设备库 |
| 设备详情点击问说明书 | `/` 带 device context | 返回设备详情或保留当前设备上下文 |
| 设备详情点击故障售后 | `/` 带 device context | 返回设备详情或保留当前设备上下文 |
| 抽屉进入执行记录 | `/runs` | 返回 Agent 主界面 |
| 执行记录列表点击详情 | `/runs/[id]` | 返回执行记录列表 |
| 抽屉点击新任务 | `/` | 清空当前输入，开启新 Agent 会话 |

### 5.7 AgentResultRenderer 结果类型

前端 `AgentResultRenderer` 必须基于 `result.type` 分发渲染，避免把所有结果做成纯文本。

```ts
type AgentResultType =
  | 'device_draft'
  | 'device_create_success'
  | 'device_selection_required'
  | 'manual_answer'
  | 'manual_no_source'
  | 'warranty_check_result'
  | 'troubleshooting_result'
  | 'save_maintenance_record_confirmation'
  | 'maintenance_record_saved'
  | 'error_recovery';
```

渲染映射：

| result.type | 组件 |
|---|---|
| device_draft | DeviceDraftCard |
| device_create_success | DeviceCreateSuccessCard |
| device_selection_required | DeviceSelectionCard |
| manual_answer | ManualAnswerCard |
| manual_no_source | ManualEmptyStateCard |
| warranty_check_result | WarrantyResultCard |
| troubleshooting_result | TroubleshootingResultCard |
| save_maintenance_record_confirmation | SaveMaintenanceRecordConfirmCard |
| maintenance_record_saved | MaintenanceRecordSavedCard |
| error_recovery | ErrorRecoveryCard |

---

## 6. 后端架构

### 6.1 apps/api 目录建议

```text
apps/api/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── attachments.py
│   │   │   ├── agent_runs.py
│   │   │   ├── devices.py
│   │   │   ├── reminders.py
│   │   │   ├── maintenance_records.py
│   │   │   └── settings.py
│   │   └── schemas/
│   │       ├── attachment.py
│   │       ├── agent_run.py
│   │       ├── device.py
│   │       ├── reminder.py
│   │       └── common.py
│   │
│   ├── db/
│   │   ├── session.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── device.py
│   │   │   ├── device_draft.py
│   │   │   ├── attachment.py
│   │   │   ├── manual_chunk.py
│   │   │   ├── reminder.py
│   │   │   ├── maintenance_record.py
│   │   │   ├── agent_run.py
│   │   │   └── agent_run_step.py
│   │   └── repositories/
│   │       ├── device_repo.py
│   │       ├── attachment_repo.py
│   │       ├── agent_run_repo.py
│   │       └── manual_repo.py
│   │
│   ├── services/
│   │   ├── storage_service.py
│   │   ├── file_parse_service.py
│   │   ├── warranty_service.py
│   │   ├── manual_index_service.py
│   │   ├── retrieval_service.py
│   │   └── safety_service.py
│   │
│   ├── agent/
│   │   ├── state.py
│   │   ├── graphs/
│   │   │   ├── create_device_graph.py
│   │   │   ├── manual_qa_graph.py
│   │   │   ├── warranty_check_graph.py
│   │   │   └── troubleshooting_graph.py
│   │   ├── nodes/
│   │   │   ├── classify_intent.py
│   │   │   ├── extract_file_content.py
│   │   │   ├── extract_device_info.py
│   │   │   ├── normalize_device_draft.py
│   │   │   ├── wait_user_confirmation.py
│   │   │   ├── create_device.py
│   │   │   ├── retrieve_manual_chunks.py
│   │   │   ├── detect_safety_risk.py
│   │   │   └── final_response.py
│   │   └── prompts/
│   │       ├── classify_intent.md
│   │       ├── extract_device_info.md
│   │       ├── manual_qa.md
│   │       └── troubleshooting.md
│   │
│   └── utils/
│       ├── ids.py
│       ├── time.py
│       └── errors.py
│
├── tests/
├── pyproject.toml
└── alembic.ini
```

### 6.2 后端分层

| 层 | 职责 |
|---|---|
| routes | HTTP API 入参、权限校验、调用 service / agent |
| schemas | Pydantic 请求和响应模型 |
| models | SQLAlchemy / SQLModel 数据库模型 |
| repositories | 数据库读写封装 |
| services | 文件存储、保修计算、说明书索引、检索、安全规则 |
| agent/graphs | LangGraph 图编排 |
| agent/nodes | 具体节点实现 |
| prompts | LLM prompt 模板 |

---

## 6.1 Mock Auth 与访问控制

v0.1 使用轻量 Mock Auth，不做注册。

### 前端路由保护

- 未登录访问业务路由时跳转 `/login`。
- 登录成功后在本地保存 session。
- 刷新页面时先进入 Auth Checking，再判断是否进入 Agent Home。
- 退出登录清除本地 session 并跳转 `/login`。

### 本地 session 结构

```json
{
  "userId": "user_home_a",
  "username": "home_a",
  "displayName": "家庭成员 A",
  "householdId": "household_default",
  "householdName": "我的家"
}
```

建议 key：

```text
localStorage: homecare_session
```

本地 session 不保存密码。

### 后端鉴权上下文

所有业务 API 都从 session / token 中解析：

```text
current_user_id
current_username
current_household_id = household_default
```

查询和写入均按 `household_id` 限定；`created_by_user_id`、`updated_by_user_id`、`confirmed_by_user_id` 用于记录操作者，不用于权限差异。

---

## 7. 数据库模型

v0.1 核心表：

```text
users
households
devices
device_drafts
attachments
manual_chunks
reminders
maintenance_records
agent_runs
agent_run_steps
```

### 7.1 users

```sql
create table users (
  id uuid primary key,
  username text not null unique,
  display_name text not null,
  household_id uuid not null references households(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

v0.1 不做账号注册，使用两个预置测试账号。两个账号都指向同一个 `household_default`，权限一致。密码不写入业务数据；如落库，应存储 hash，不存明文。

```ts
const TEST_USERS = [
  {
    id: "user_home_a",
    username: "home_a",
    password: "home123456",
    displayName: "家庭成员 A",
    householdId: "household_default",
  },
  {
    id: "user_home_b",
    username: "home_b",
    password: "home123456",
    displayName: "家庭成员 B",
    householdId: "household_default",
  },
];
```

### 7.1.1 households

```sql
create table households (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

v0.1 只有一个固定家庭空间：`household_default`，展示名称为「我的家」。不做多家庭切换、邀请成员、成员角色或权限差异。

---

### 7.2 devices

```sql
create table devices (
  id uuid primary key,
  household_id uuid not null references households(id),
  created_by_user_id uuid references users(id),

  name text not null,
  brand text,
  model text,
  category text,

  purchase_date date,
  purchase_price numeric(12, 2),
  purchase_channel text,

  warranty_months integer,
  warranty_end_date date,

  serial_number text,
  service_phone text,
  notes text,

  source_agent_run_id uuid,
  source_device_draft_id uuid,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

说明：

1. `warranty_end_date` 可以存储。
2. `warranty_status` 不建议存储，应运行时计算。
3. 删除采用 soft delete。

---

### 7.3 device_drafts

```sql
create table device_drafts (
  id uuid primary key,
  household_id uuid not null references households(id),
  created_by_user_id uuid references users(id),
  agent_run_id uuid references agent_runs(id),

  name text,
  brand text,
  model text,
  category text,

  purchase_date date,
  purchase_price numeric(12, 2),
  purchase_channel text,

  warranty_months integer,
  warranty_end_date date,

  serial_number text,
  service_phone text,
  notes text,

  confidence numeric(4, 3),
  missing_fields jsonb not null default '[]',
  source_attachment_ids jsonb not null default '[]',
  suggested_reminders jsonb not null default '[]',

  raw_extraction jsonb,
  normalized_payload jsonb,

  status text not null default 'pending_confirmation',

  confirmed_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

状态：

```text
pending_confirmation
modified
confirmed
cancelled
expired
```

---

### 7.4 attachments

```sql
create table attachments (
  id uuid primary key,
  household_id uuid not null references households(id),
  created_by_user_id uuid references users(id),

  device_id uuid references devices(id),
  agent_run_id uuid references agent_runs(id),
  device_draft_id uuid references device_drafts(id),

  file_name text not null,
  mime_type text not null,
  size_bytes bigint,

  storage_bucket text not null,
  storage_key text not null,

  attachment_type text not null default 'other',
  parse_status text not null default 'pending',

  extracted_text text,
  parse_error text,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

附件类型：

```text
order_screenshot
invoice
manual
warranty_card
device_photo
repair_receipt
other
```

解析状态：

```text
pending
uploading
uploaded
parsing
parsed
failed
```

---

### 7.5 manual_chunks

```sql
create table manual_chunks (
  id uuid primary key,
  household_id uuid not null references households(id),
  created_by_user_id uuid references users(id),
  device_id uuid not null references devices(id),
  attachment_id uuid not null references attachments(id),

  chunk_index integer not null,
  page_number integer,
  section_title text,
  content text not null,

  embedding vector(1536),

  created_at timestamptz not null default now()
);
```

注意：embedding 维度取决于最终使用的 embedding 模型。

检索时必须带：

```sql
where household_id = :household_id
and device_id = :device_id
```

---

### 7.6 reminders

```sql
create table reminders (
  id uuid primary key,
  household_id uuid not null references households(id),
  created_by_user_id uuid references users(id),
  device_id uuid references devices(id),

  type text not null,
  title text not null,
  description text,

  remind_at timestamptz not null,
  status text not null default 'pending',

  source text,
  source_agent_run_id uuid references agent_runs(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

类型：

```text
warranty_expiry
maintenance
consumable
custom
```

状态：

```text
pending
completed
ignored
cancelled
```

---

### 7.7 maintenance_records

```sql
create table maintenance_records (
  id uuid primary key,
  household_id uuid not null references households(id),
  created_by_user_id uuid references users(id),
  device_id uuid not null references devices(id),

  type text not null,
  title text not null,
  description text,

  occurred_at timestamptz,
  cost numeric(12, 2),

  related_attachment_ids jsonb not null default '[]',
  source_agent_run_id uuid references agent_runs(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

类型：

```text
installation
maintenance
troubleshooting
repair
consumable_replacement
other
```

---

### 7.8 agent_runs

```sql
create table agent_runs (
  id uuid primary key,
  household_id uuid not null references households(id),
  created_by_user_id uuid references users(id),

  thread_id text,
  intent text,
  status text not null default 'created',

  input_text text,
  input_payload jsonb not null default '{}',

  current_node text,
  waiting_for text,

  result_payload jsonb,
  error_message text,

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

intent：

```text
create_device
manual_qa
warranty_check
troubleshooting
unknown
```

status：

```text
created
running
needs_confirmation
applying_action
completed
failed
cancelled
```

waiting_for：

```text
device_draft_confirmation
device_selection
save_maintenance_record_confirmation
```

---

### 7.9 agent_run_steps

```sql
create table agent_run_steps (
  id uuid primary key,
  agent_run_id uuid not null references agent_runs(id),

  node_name text not null,
  status text not null,

  input_snapshot jsonb,
  output_snapshot jsonb,
  error_message text,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
```

状态：

```text
pending
running
completed
interrupted
failed
skipped
```

---

## 8. 文件上传与 S3 / MinIO 方案

### 8.1 上传流程

```text
1. 前端选择图片 / PDF
2. 前端请求 POST /attachments/presign
3. 后端创建 attachment 草稿记录
4. 后端生成 presigned upload URL
5. 前端直接 PUT 到 S3 / MinIO
6. 前端调用 POST /attachments/:id/complete
7. 后端更新 attachment.parse_status = uploaded
8. 用户提交 AgentRun
9. LangGraph 读取 attachment 并解析
```

### 8.2 对象 key 规则

```text
households/{household_id}/attachments/{attachment_id}/original
households/{household_id}/attachments/{attachment_id}/preview.webp
households/{household_id}/attachments/{attachment_id}/extracted.txt
```

### 8.3 文件格式

支持：

```text
jpg
jpeg
png
webp
pdf
```

不支持格式时返回：

```text
UNSUPPORTED_FILE_TYPE
```

### 8.4 文件与设备绑定原则

```text
上传文件 → attachment.device_id = null
Agent 解析 → 生成 device_draft
用户确认 → 创建设备
确认后 → attachment.device_id = new_device.id
```

---

## 9. API 合同

### 9.1 通用响应格式

成功：

```json
{
  "data": {},
  "error": null,
  "request_id": "req_xxx"
}
```

失败：

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "设备名称不能为空",
    "details": {}
  },
  "request_id": "req_xxx"
}
```

常见错误码：

```text
VALIDATION_ERROR
NOT_FOUND
UNAUTHORIZED
FORBIDDEN
UPLOAD_FAILED
AGENT_RUN_FAILED
AGENT_RUN_NOT_WAITING
UNSUPPORTED_FILE_TYPE
CONFIRMATION_REQUIRED
DANGEROUS_ACTION_BLOCKED
```

---

### 9.2 附件 API

```http
POST /attachments/presign
```

请求：

```json
{
  "file_name": "order.png",
  "mime_type": "image/png",
  "size_bytes": 839201,
  "source": "agent_composer"
}
```

返回：

```json
{
  "data": {
    "attachment": {
      "id": "att_001",
      "file_name": "order.png",
      "mime_type": "image/png",
      "size_bytes": 839201,
      "attachment_type": "other",
      "parse_status": "pending",
      "storage_bucket": "homecare-attachments",
      "storage_key": "users/u_001/attachments/att_001/original"
    },
    "upload": {
      "url": "https://minio.example.com/...",
      "method": "PUT",
      "headers": {
        "Content-Type": "image/png"
      },
      "expires_in": 900
    }
  },
  "error": null
}
```

```http
POST /attachments/:id/complete
```

```http
DELETE /attachments/:id
```

---

### 9.3 AgentRun API

```http
POST /agent/runs
```

请求：

```json
{
  "input_text": "帮我把这个设备建档",
  "intent_hint": "create_device",
  "attachment_ids": ["att_001", "att_002"],
  "context": {
    "device_id": null,
    "source": "agent_home"
  }
}
```

返回：

```json
{
  "data": {
    "run": {
      "id": "run_001",
      "status": "running",
      "intent": "create_device",
      "current_node": "classify_intent",
      "waiting_for": null,
      "message": "正在理解任务"
    }
  },
  "error": null
}
```

```http
GET /agent/runs/:id
```

返回 needs_confirmation 示例：

```json
{
  "data": {
    "run": {
      "id": "run_001",
      "status": "needs_confirmation",
      "intent": "create_device",
      "current_node": "wait_user_confirmation",
      "waiting_for": "device_draft_confirmation",
      "message": "等待你确认设备草稿",
      "result": {
        "type": "device_draft",
        "device_draft": {
          "id": "draft_001",
          "name": "小米净水器 H1000G",
          "brand": "小米",
          "model": "H1000G",
          "category": "厨房设备",
          "purchase_date": "2026-06-20",
          "warranty_months": 24,
          "warranty_end_date": "2028-06-20",
          "serial_number": null,
          "missing_fields": ["serial_number"],
          "source_attachment_ids": ["att_001", "att_002"],
          "suggested_reminders": [
            {
              "type": "warranty_expiry",
              "title": "小米净水器 H1000G 保修即将到期",
              "remind_at": "2028-05-21T09:00:00Z"
            }
          ],
          "confidence": 0.86
        }
      }
    }
  },
  "error": null
}
```

```http
POST /agent/runs/:id/resume
```

确认创建设备：

```json
{
  "action": "confirm_device_draft",
  "device_draft_id": "draft_001",
  "payload": {
    "confirmed_fields": {
      "name": "小米净水器 H1000G",
      "brand": "小米",
      "model": "H1000G",
      "category": "厨房设备",
      "purchase_date": "2026-06-20",
      "warranty_months": 24,
      "serial_number": null
    }
  }
}
```

修改草稿：

```json
{
  "action": "modify_device_draft",
  "device_draft_id": "draft_001",
  "payload": {
    "patch": {
      "model": "H1000G Pro",
      "warranty_months": 36
    }
  }
}
```

取消草稿：

```json
{
  "action": "cancel_device_draft",
  "device_draft_id": "draft_001",
  "payload": {
    "reason": "用户取消"
  }
}
```

---

### 9.4 Agent 结果 Payload Schema

所有 AgentRun 的结构化结果必须使用 `result.type` 区分，前端不解析自由文本来判断卡片类型。

#### device_selection_required

```json
{
  "type": "device_selection_required",
  "message": "你说的是哪台设备？",
  "candidates": [
    {
      "id": "dev_001",
      "name": "小米净水器 H1000G",
      "brand": "小米",
      "model": "H1000G",
      "category": "厨房设备",
      "warranty_status": "in_warranty"
    }
  ]
}
```

#### manual_answer

```json
{
  "type": "manual_answer",
  "device_id": "dev_001",
  "answer": {
    "summary": "滤芯清洗前请先关闭进水阀。",
    "steps": ["关闭进水阀", "断开电源", "取出滤芯并按说明冲洗"],
    "sources": [
      {
        "attachment_id": "att_manual_001",
        "file_name": "manual.pdf",
        "page_number": 12,
        "snippet": "..."
      }
    ]
  }
}
```

#### manual_no_source

```json
{
  "type": "manual_no_source",
  "reason": "no_manual | answer_not_found",
  "message": "这台设备还没有上传说明书。"
}
```

#### troubleshooting_result

```json
{
  "type": "troubleshooting_result",
  "device_id": "dev_001",
  "warranty_status": "in_warranty",
  "safety_alert": {
    "level": "warning",
    "title": "安全提醒",
    "message": "先停止使用并关闭进水阀，再联系官方售后。"
  },
  "actions": ["关闭进水阀", "擦干周围水渍", "拍照记录漏水位置"],
  "support_message": "...",
  "materials": ["订单截图", "设备序列号", "故障照片"],
  "can_save_record": true
}
```

#### save_maintenance_record_confirmation

```json
{
  "type": "save_maintenance_record_confirmation",
  "device_id": "dev_001",
  "record_draft": {
    "type": "troubleshooting",
    "title": "净水器漏水",
    "description": "用户反馈机身底部漏水，已建议关闭进水阀并联系售后。",
    "occurred_at": "2026-06-30T09:00:00Z"
  }
}
```

---

### 9.5 设备 API

```http
GET /devices
```

查询参数：

```text
q=小米
status=in_warranty | expiring_soon | expired | unknown
limit=20
cursor=xxx
```

```http
GET /devices/:id
```

```http
PATCH /devices/:id
```

```http
POST /devices/:id/delete-confirmation
```

```http
DELETE /devices/:id
```

---

### 9.6 提醒 API

```http
GET /reminders
POST /reminders/:id/complete
POST /reminders/:id/ignore
```

---

### 9.7 执行记录 API

```http
GET /agent/runs
GET /agent/runs/:id/detail
```

---

## 10. LangGraph 工作流设计

### 10.1 全局 AgentState

```python
class AgentState(TypedDict, total=False):
    run_id: str
    user_id: str
    household_id: str
    thread_id: str

    input_text: str
    intent_hint: str | None
    intent: str

    attachment_ids: list[str]
    context: dict

    device_id: str | None
    candidate_devices: list[dict]

    extracted_files: list[dict]
    extracted_text: str | None

    device_draft_id: str | None
    device_draft: dict | None

    manual_chunks: list[dict]
    warranty_result: dict | None
    troubleshooting_result: dict | None

    waiting_for: str | None
    confirmation_payload: dict | None

    result: dict | None
    error: dict | None
```

---

### 10.2 create_device 自动建档工作流

```text
start
↓
classify_intent
↓
load_attachments
↓
extract_file_content
↓
extract_device_info
↓
normalize_device_draft
↓
generate_device_draft
↓
persist_device_draft
↓
wait_user_confirmation  ← interrupt
↓
apply_user_confirmation
↓
create_device
↓
attach_files_to_device
↓
create_warranty_reminder
↓
index_manual_if_exists
↓
final_response
```

关键规则：

1. `create_device`、`attach_files_to_device`、`create_warranty_reminder`、`index_manual_if_exists` 必须发生在用户确认之后。
2. `wait_user_confirmation` 必须让前端进入 `needs_confirmation`。
3. 用户修改草稿后，继续停留在确认态。
4. 用户取消后，AgentRun 进入 `cancelled`。
5. 用户确认后，AgentRun 进入 `applying_action`，然后继续写入。

---

### 10.3 manual_qa 说明书问答工作流

```text
start
↓
classify_intent
↓
resolve_device_context
↓
check_manual_exists
↓
retrieve_manual_chunks
↓
generate_manual_answer
↓
final_response
```

如果设备不明确：

```text
resolve_device_context
↓
wait_device_selection ← interrupt
↓
retrieve_manual_chunks
```

强制规则：

1. 没有说明书时，不得编造，返回 `no_manual`。
2. 检索不到答案时，不得编造，返回 `manual_answer_not_found`。
3. 回答必须包含来源信息。
4. 检索必须按 `household_id + device_id` 限定。

---

### 10.4 warranty_check 保修查询工作流

```text
start
↓
classify_intent
↓
resolve_device_context
↓
calculate_warranty_status
↓
final_response
```

如果用户询问“哪些设备快过保了”：

```text
query_expiring_devices
↓
final_response
```

保修状态规则：

| 条件 | 状态 |
|---|---|
| 缺少购买日期或保修期 | unknown |
| 当前日期 > warranty_end_date | expired |
| 距离 warranty_end_date <= 30 天 | expiring_soon |
| 其他 | in_warranty |

---

### 10.5 troubleshooting 故障售后工作流

```text
start
↓
classify_intent
↓
resolve_device_context
↓
detect_safety_risk
↓
calculate_warranty_status
↓
retrieve_manual_chunks_optional
↓
generate_troubleshooting_result
↓
wait_save_record_confirmation ← optional interrupt
↓
save_maintenance_record
↓
final_response
```

输出必须包含：

```text
设备信息
保修状态
安全提醒
先做这几件事
售后沟通文案
需要准备的材料
保存故障记录操作
```

安全风险包括：

```text
强电
燃气
水路拆装
高温设备
电池膨胀
明火
漏电
需要拆机维修
```

命中高风险时，必须保守提示：

```text
停止使用
断电 / 关闭阀门
远离明火
联系官方售后或专业人员
不提供拆机、带电、燃气维修步骤
```

---

### 10.6 AgentRunStep 记录规则

节点开始：

```text
status = running
started_at = now()
```

节点成功：

```text
status = completed
finished_at = now()
output_snapshot = {...}
```

节点等待用户：

```text
status = interrupted
finished_at = now()
```

节点跳过：

```text
status = skipped
finished_at = now()
```

节点失败：

```text
status = failed
error_message = ...
finished_at = now()
```

---

## 11. 说明书 RAG 方案

### 11.1 索引流程

```text
说明书 PDF 上传
↓
用户确认创建设备
↓
index_manual_if_exists
↓
提取 PDF 文本
↓
按页码 / 小节切分 chunk
↓
生成 embedding
↓
写入 manual_chunks
```

### 11.2 问答流程

```text
用户提问
↓
确定 device_id
↓
检查 manual_chunks 是否存在
↓
pgvector 检索 top_k chunks
↓
判断是否有足够依据
↓
基于 chunks 生成回答
↓
返回来源文件 / 页码 / 小节
```

### 11.3 不编造规则

1. 没有说明书：返回 `no_manual`。
2. 说明书检索不到答案：返回 `manual_answer_not_found`。
3. 不允许使用模型常识伪装成说明书内容。
4. 回答必须带来源。

---

## 12. 故障售后安全策略

### 12.1 禁止行为

v0.1 禁止：

```text
自动联系售后
自动发送邮件
自动发送短信
自动发送微信
自动购买耗材
自动删除大量数据
指导高风险维修
指导燃气维修
指导带电维修
指导复杂拆机维修
```

### 12.2 高风险处理规则

遇到以下情况：

```text
强电
燃气
水路拆装
高温设备
电池膨胀
明火
漏电
需要拆机维修
```

输出策略：

```text
优先停止使用
优先断电 / 关闭阀门
提醒拍照留存证据
建议联系官方售后或专业人员
不提供危险操作步骤
```

### 12.3 保存故障记录规则

```text
生成故障建议 ≠ 保存故障记录
```

用户点击「保存故障记录」后，必须先展示确认内容。确认后才写入 `maintenance_records`。

---

## 13. 本地开发环境

### 13.1 本地服务

```text
Next.js Web App: http://localhost:3000
FastAPI Backend: http://localhost:8000
PostgreSQL: localhost:5432
MinIO API: http://localhost:9000
MinIO Console: http://localhost:9001
```

### 13.2 .env.example

```env
# App
APP_ENV=development
APP_NAME=HomeCare Agent

# Web
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# API
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Database
DATABASE_URL=postgresql+psycopg://homecare:homecare@localhost:5432/homecare_agent

# Object Storage
S3_ENDPOINT_URL=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_ATTACHMENTS=homecare-attachments
S3_BUCKET_TEMP=homecare-temp
S3_FORCE_PATH_STYLE=true

# OpenAI
OPENAI_API_KEY=replace_me

# LangGraph
LANGGRAPH_CHECKPOINT_DB=postgres
```

### 13.3 docker-compose.yml

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: homecare-postgres
    environment:
      POSTGRES_USER: homecare
      POSTGRES_PASSWORD: homecare
      POSTGRES_DB: homecare_agent
    ports:
      - "5432:5432"
    volumes:
      - homecare_postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    container_name: homecare-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - homecare_minio_data:/data

volumes:
  homecare_postgres_data:
  homecare_minio_data:
```

### 13.4 本地启动流程

```bash
# 1. 启动基础设施
docker compose -f infra/docker-compose.yml up -d

# 2. 初始化 MinIO bucket
./scripts/create-minio-buckets.sh

# 3. 安装前端依赖
cd apps/web
pnpm install
pnpm dev

# 4. 安装后端依赖
cd apps/api
uv sync
uvicorn app.main:app --reload --port 8000

# 5. 执行数据库迁移
cd apps/api
alembic upgrade head

# 6. 初始化 Demo 数据
python ../../scripts/seed-demo-data.py
```

---

## 14. 部署方案

### 14.1 推荐轻量部署

```text
前端：Vercel / 静态托管 / 自托管 Node
后端：Render / Railway / Fly.io / ECS / 云服务器
数据库：托管 PostgreSQL + pgvector
文件：S3 兼容对象存储
```

### 14.2 不建议 v0.1 使用 Kubernetes

原因：

1. v0.1 的重点是验证 Agent 产品闭环。
2. Kubernetes 会增加基础设施复杂度。
3. 单 FastAPI 服务 + 托管数据库 + 对象存储已足够。

### 14.3 环境划分

```text
development  本地开发
staging      线上预览 / 测试环境
production   正式环境
```

v0.1 至少需要 development 和 staging。

---

### 14.4 Demo Seed 数据清单

v0.1 至少准备一套固定 Demo 数据，用于 Figma 对照、Mock UI、E2E 和演示。

| 数据 ID | 类型 | 内容 |
|---|---|---|
| D-001 | 设备 | 小米净水器 H1000G |
| ATT-001 | 订单截图 | 包含商品名、型号、购买日期、金额、订单号 |
| ATT-002 | 说明书 PDF | 包含滤芯清洗、错误代码、保养周期 |
| ATT-003 | 保修卡图片 | 包含保修期、售后电话、序列号 |
| RUN-001 | 自动建档 | 上传订单截图 + 说明书，生成设备草稿 |
| RUN-002 | 说明书问答 | 问“滤芯怎么清洗？”并返回来源 |
| RUN-003 | 故障售后 | 问“净水器漏水了怎么办？”并生成安全提醒、步骤、售后文案、材料清单 |
| RUN-004 | 设备选择 | 多台净水器时触发候选设备选择 |

Demo 数据必须覆盖：

```text
自动建档草稿
确认创建设备
设备详情
说明书问答成功态
无说明书 / 未找到答案态
故障售后结果
保存故障记录确认态
执行过程详情
```

---

## 15. 测试策略

### 15.1 前端测试

重点组件：

```text
AppShell
SideDrawer
BottomComposer
UploadedFileCard
DeviceDraftCard
DeviceDraftEditSheet
DeviceCreateSuccessCard
AgentResultRenderer
AgentExecutionSheet
ManualAnswerCard
TroubleshootingResultCard
```

重点页面：

```text
Agent 主界面
设备库
设备详情
提醒页
执行记录页
```

---

### 15.2 后端测试

API 测试：

```text
attachments presign / complete
agent_runs create / get / resume
devices list / detail
reminders list / complete / ignore
```

Service 测试：

```text
storage_service
warranty_service
manual_index_service
retrieval_service
safety_service
```

---

### 15.3 Agent 工作流测试

```text
create_device 正常流程
create_device 用户修改草稿
create_device 用户取消
create_device 解析失败
manual_qa 有说明书
manual_qa 无说明书
manual_qa 未找到答案
troubleshooting 普通故障
troubleshooting 高风险故障
```

---

### 15.4 端到端测试

```text
上传资料建档
确认创建设备
查看设备详情
问说明书
故障售后
保存故障记录
查看执行记录
```

---

## 16. 研发里程碑

### M1：移动端 H5 / PWA 产品外壳

范围：

```text
Next.js App Router
PWA manifest
移动端布局
TopBar
SideDrawer
BottomComposer
Agent 主界面空状态
快捷建议按钮
设备库空状态
提醒页空状态
执行记录空状态
设置页占位
```

验收：

```text
打开应用后进入 Agent 主界面
没有底部五 Tab
左上角菜单可打开左侧抽屉
设备库 / 提醒 / 执行记录 / 设置可从抽屉进入
底部只保留 Composer
移动端 360px 宽度不溢出
```

---

### M2：Mock 自动建档 UI 闭环

范围：

```text
上传菜单
UploadedFileCard
Agent running 状态
执行过程底部弹窗
DeviceDraftCard
查看全部字段
DeviceDraftEditSheet
确认创建
DeviceCreateSuccessCard
跳转设备详情
```

验收：

```text
草稿确认前不得出现“设备已创建”
修改草稿后卡片内容更新
确认创建后展示完成结果
点击查看设备进入设备详情
执行过程默认收起，可展开查看
```

---

### M3：Postgres + MinIO + FastAPI 数据层

范围：

```text
Postgres + pgvector
MinIO
Alembic migrations
attachments presign / complete
devices 基础 API
agent_runs 基础 API
reminders 基础 API
本地 demo seed
```

验收：

```text
文件能上传到 MinIO
attachments 表有记录
设备能写入 devices 表
设备库能读取真实 devices
设备详情能读取真实附件 / 提醒 / 记录
AgentRun 能创建和查询
```

---

### M4：LangGraph create_device 主流程

范围：

```text
POST /agent/runs
GET /agent/runs/:id
POST /agent/runs/:id/resume
classify_intent
load_attachments
extract_file_content
extract_device_info
normalize_device_draft
generate_device_draft
persist_device_draft
wait_user_confirmation interrupt
create_device
attach_files_to_device
create_warranty_reminder
index_manual_if_exists
final_response
```

验收：

```text
上传订单截图和说明书 PDF
提交“帮我把这个设备建档”
LangGraph 生成 DeviceDraft
前端进入 needs_confirmation
用户确认后 resume
确认后才写入 devices
确认后才绑定 attachments
确认后才创建 reminder
确认后才索引说明书
AgentRunStep 记录完整节点路径
```

---

### M5：说明书问答 RAG

范围：

```text
PDF 文本提取
manual_chunks 表
embedding 生成
pgvector 检索
ManualAnswerCard
来源展示
无说明书状态
未检索到答案状态
```

验收：

```text
从设备详情点击“问说明书”
自动带入 device_id
检索当前设备说明书
返回结构化答案
展示来源页码 / 文件名
无说明书时不编造
说明书没有答案时不编造
```

---

### M6：故障售后 Demo

范围：

```text
troubleshooting AgentRun
resolve_device_context
detect_safety_risk
calculate_warranty_status
retrieve_manual_chunks_optional
generate_troubleshooting_result
TroubleshootingResultCard
SafetyAlertCard
售后沟通文案
材料清单
保存故障记录确认
```

推荐 Demo：

```text
我的净水器漏水了，帮我看看怎么办。
```

验收：

```text
能识别设备
能展示保修状态
能展示安全提醒
能生成先做这几件事
能生成售后沟通文案
能列出材料清单
保存故障记录前必须确认
高风险场景不得指导拆机 / 带电 / 燃气维修
```

---

### M7：回归测试与验收修复

范围：

```text
自动建档主链路
草稿确认和取消
修改草稿
文件上传失败恢复
说明书问答不编造
故障售后安全边界
保修状态计算
提醒创建
执行记录
移动端窄屏适配
键盘不遮挡 Composer
底部弹窗不遮挡保存按钮
```

---

## 17. 给 Codex / Cursor 的任务拆分

```text
Task 01：创建 monorepo 基础结构和 README
Task 02：初始化 Next.js PWA 移动端项目
Task 03：实现 AppShell / TopBar / SideDrawer / BottomComposer
Task 04：实现 Agent 主界面空状态和快捷建议
Task 05：实现 Mock Agent 自动建档 UI 闭环
Task 05A：补齐关键中间态组件：SideDrawer、UploadActionSheet、DeviceSelection、ExecutionSheet、SaveMaintenanceRecordConfirm
Task 05B：补齐 AgentResultRenderer result.type 分发与结果卡 schema
Task 06：初始化 FastAPI 项目
Task 07：添加 Docker Compose：Postgres + MinIO
Task 08：创建数据库 migration
Task 09：实现 attachments presign / complete API
Task 10：实现 devices 基础 API
Task 11：实现 agent_runs 基础 API
Task 12：实现 create_device LangGraph mock workflow
Task 13：实现 LangGraph interrupt / resume
Task 14：接入真实文件解析和 DeviceDraft 生成
Task 15：实现说明书 RAG
Task 16：实现故障售后 Demo
Task 17：同步测试用例文档并做回归
```

---

## 18. 风险与待处理事项

### 18.1 Figma 设计稿对齐状态

测试用例文档已同步为 Agent-first + 左侧抽屉 + 无底部导航口径。当前 Figma P0 对齐口径为：左侧抽屉不做「数据导出」独立入口，数据导出统一收纳在设置页。

正式编码前，Figma 必须保持以下 P0 画板与状态可用：

```text
00 App Shell / Drawer Closed
00B App Shell / Drawer Open
00C Drawer Item Selected
01B Upload Action Sheet
01C Upload File States
02C Device Selection
02D Execution Process Sheet
02E Device Create Success
02F Device Draft Edit Sheet
03C Save Fault Record Confirmation
05B Warranty Check Result
06 Manual QA No Manual
06B Manual Answer Not Found
06C Manual Answer Success
06D Manual Source Sheet
08 Agent Run List
08 Agent Run Detail
```

编码前还必须做一次静态走查：icon 不得使用字符或错误旋转线段；check、chevron、close、send 等图标必须为可复用矢量图层；Composer 不得遮挡核心操作。

### 18.2 PWA 移动端能力边界

v0.1 使用 H5 / PWA，需要接受：

```text
拍照能力依赖浏览器 file input
无法完全控制原生相机 UI
复杂扫描增强能力暂不做
系统级推送暂不做
离线 Agent 任务暂不做
```

### 18.3 文件解析质量风险

订单截图、发票、保修卡、说明书 PDF 的质量可能不稳定。

应对策略：

```text
解析失败时提供重新上传 / 手动填写 / 仅保存附件
DeviceDraft 展示 confidence 和 missing_fields
写入前必须用户确认
```

### 18.4 说明书问答不编造风险

必须从技术上保证：

```text
没有 manual_chunks 不回答说明书内容
检索结果不足不回答说明书内容
回答必须携带来源
```

---

## 19. 当前技术结论

HomeCare Agent v0.1 技术方案最终收敛为：

```text
Next.js PWA / 移动端 H5
+ Python FastAPI
+ LangGraph
+ PostgreSQL / pgvector
+ S3 / MinIO
+ OpenAI API
```

研发顺序为：

```text
先 UI Mock 闭环
再数据层
再 LangGraph
再 RAG
再故障售后
最后回归验收
```

v0.1 的技术目标不是做复杂平台，而是完整打通：

```text
移动端上传资料
↓
Agent 自动生成设备草稿
↓
用户确认
↓
创建设备档案
↓
绑定附件和提醒
↓
索引说明书
↓
说明书问答
↓
故障售后辅助
↓
执行记录可追踪
```

该技术方案可作为后续编码、测试、验收和迭代扩展的基础。
