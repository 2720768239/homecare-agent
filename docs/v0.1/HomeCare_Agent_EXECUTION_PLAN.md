# HomeCare Agent v0.1 编码执行计划

版本：v0.1-execution-plan  
文档类型：编码执行计划 / Coding Execution Plan  
适用对象：编码 Agent / 开发 Agent / Codex / Cursor / Claude Code  
产品形态：移动端 PWA / 移动端 H5  
技术栈：Next.js PWA + Python FastAPI + LangGraph + PostgreSQL + S3/MinIO  
最后更新：2026-07-01

---

## 0. 交付目标

本计划用于指导编码 Agent 实现 HomeCare Agent v0.1 的第一版可运行 MVP。

目标不是一次性实现完整商业产品，而是实现一个移动端 Agent-first 的闭环 Demo / MVP：

```text
账号名 + 密码登录
→ 进入同一个家庭空间「我的家」
→ 上传资料或输入任务
→ Agent 识别意图
→ 生成设备草稿 / 回答说明书 / 查询保修 / 故障售后
→ 用户确认关键写入
→ 创建设备 / 保存记录
→ 可查看设备、附件、提醒、执行记录和设置
```

本计划的优先级高于零散口头讨论。编码时如发现 PRD、DESIGN、TECH_SPEC、TEST_CASES 与本文冲突，以本文的“冻结范围”和“阶段交付顺序”为准，再反向同步文档。

---

## 1. 当前冻结范围

### 1.1 必须实现的范围

#### 产品形态

- 仅实现移动端应用体验。
- 使用 Next.js PWA / 移动端 H5。
- 以 390px 宽度设计稿为主要参考，同时兼容 360px 常见移动宽度。
- 不实现 PC 管理台。
- 不实现传统底部五 Tab。
- 使用 ChatGPT 类似结构：顶部栏 + 左侧抽屉 + 中央 Agent 内容 + 底部 Composer。

#### 登录与家庭空间

v0.1 需要实现轻量登录：

- 登录方式：账号名 + 密码。
- 不做注册。
- 不做忘记密码。
- 不做第三方登录。
- 写死两个测试账号。
- 两个账号代表同一个家庭的两个成员。
- 两个账号共享同一个家庭空间和同一套设备数据。
- 不做数据隔离。
- 不做多家庭。
- 不做成员邀请。
- 不做角色权限。

预置账号：

| username | password | display_name | household_id |
|---|---|---|---|
| `home_a` | `home123456` | `家庭成员 A` | `household_default` |
| `home_b` | `home123456` | `家庭成员 B` | `household_default` |

家庭空间：

```text
household_id: household_default
household_name: 我的家
```

登录成功后进入 Agent Home。退出登录只清除当前登录态，不删除家庭数据。

#### Agent 能力

v0.1 需要覆盖 4 类核心意图：

| 意图 | 说明 | 是否实现 |
|---|---|---:|
| `create_device` | 上传订单 / 发票 / 说明书 / 保修卡后生成设备草稿 | 是 |
| `manual_qa` | 基于说明书回答问题 | 是 |
| `warranty_check` | 查询设备保修状态 | 是 |
| `troubleshooting` | 故障排查和售后辅助 | 是 |

#### 业务模块

第一轮必须实现：

- Auth Checking
- Login
- Login Error
- Auth Guard
- Logout
- Agent Home
- 左侧抽屉
- 上传 Action Sheet
- 文件上传状态
- 设备选择态
- 设备草稿确认
- 设备草稿编辑 Sheet
- 设备创建成功
- 设备库
- 设备详情
- 说明书问答成功 / 无说明书 / 未找到答案 / 来源详情
- 保修查询结果
- 故障售后普通结果
- 高风险安全响应
- 保存故障记录确认
- 提醒列表
- Agent 执行记录列表
- Agent 执行记录详情
- 设置页

---

## 2. 明确不做范围

v0.1 不做以下内容。编码 Agent 不应自行扩展这些能力。

```text
账号注册
忘记密码
短信验证码
邮箱验证码
微信登录
Google 登录
多家庭切换
家庭成员邀请
管理员 / 普通成员角色
权限管理
两个账号的数据隔离
多人实时协作冲突处理
PC/Web 独立适配
传统底部五 Tab
系统级推送
真实售后工单提交
自动联系售后
自动购买耗材
电商订单自动导入
复杂设备合并
复杂知识库后台
复杂全文搜索后台
```

删除类能力第一轮也不做：

```text
删除设备
删除附件
永久删除执行记录
永久删除家庭空间
```

如页面需要出现相关入口，应隐藏或禁用，不要实现半成品删除逻辑。

---

## 3. Mock 与真实能力边界

这是编码时最重要的范围控制。

v0.1 推荐采用：**应用流程真实，Agent 工具结果部分 mock。**

| 能力 | v0.1 实现口径 |
|---|---|
| 登录 | 本地 / 后端 mock auth 均可，但必须有 Auth Guard 和 session 保持 |
| 设备、提醒、执行记录 | 推荐真实持久化；开发早期可先 seed/mock，后接 API |
| 文件上传 | 第一轮可实现前端上传状态和后端占位接口；文件内容解析可 mock |
| S3/MinIO | 可先本地文件存储或 mock URL；最终保留 S3/MinIO 适配层 |
| OCR | 第一轮 mock，不阻塞主链路 |
| PDF 解析 | 第一轮 mock，不阻塞主链路 |
| 说明书 RAG | 第一轮用 seed chunks / mock chunks，不做复杂向量检索也可以 |
| LangGraph | 使用真实 LangGraph 流程骨架，节点工具结果可 mock |
| 保修计算 | 必须真实计算 |
| 高风险安全判断 | 必须真实规则判断 |
| Agent 执行记录 | 必须真实记录每次 Agent 任务的状态、节点路径和结果摘要 |

编码 Agent 不要把第一轮目标扩大成“完整 OCR + 完整 PDF 解析 + 完整 RAG + 完整向量检索”。

---

## 4. 推荐工程结构

### 4.1 前端目录建议

```text
apps/web/
  app/
    login/page.tsx
    auth/checking/page.tsx             # 可选，也可用根路由 loading
    page.tsx                           # Agent Home
    devices/page.tsx
    devices/[id]/page.tsx
    reminders/page.tsx
    runs/page.tsx
    runs/[id]/page.tsx
    settings/page.tsx
  components/
    app-shell/
      AppShell.tsx
      TopBar.tsx
      SideDrawer.tsx
      Composer.tsx
      AuthGuard.tsx
    auth/
      LoginForm.tsx
      AuthChecking.tsx
    agent/
      AgentHome.tsx
      UploadActionSheet.tsx
      FileStateList.tsx
      DeviceDraftCard.tsx
      DeviceDraftEditSheet.tsx
      DeviceCreateSuccessCard.tsx
      DeviceSelectionCard.tsx
      AgentExecutionSheet.tsx
      AgentResultRenderer.tsx
      ManualAnswerCard.tsx
      ManualSourceSheet.tsx
      WarrantyResultCard.tsx
      TroubleshootingResultCard.tsx
      HighRiskSafetyCard.tsx
      SaveFaultRecordConfirmation.tsx
    devices/
      DeviceList.tsx
      DeviceCard.tsx
      DeviceDetail.tsx
      DeviceEmptyState.tsx
    reminders/
      ReminderList.tsx
      ReminderCard.tsx
    runs/
      AgentRunList.tsx
      AgentRunDetail.tsx
    settings/
      SettingsPage.tsx
  lib/
    api-client.ts
    auth.ts
    mock-data.ts
    types.ts
    validators.ts
  store/
    auth-store.ts
    ui-store.ts
```

### 4.2 后端目录建议

```text
apps/api/
  main.py
  app/
    api/
      auth.py
      devices.py
      attachments.py
      reminders.py
      agent_runs.py
      settings.py
    core/
      config.py
      security.py
    db/
      session.py
      models.py
      schemas.py
      seed.py
    services/
      auth_service.py
      device_service.py
      attachment_service.py
      reminder_service.py
      warranty_service.py
      safety_service.py
    agent/
      graph.py
      state.py
      nodes.py
      tools.py
      mock_tools.py
```

---

## 5. 前端路由范围

第一轮需要实现以下路由：

| 路由 | 页面 | Auth Guard |
|---|---|---:|
| `/login` | 登录页 | 否 |
| `/` | Agent Home | 是 |
| `/devices` | 设备库 | 是 |
| `/devices/[id]` | 设备详情 | 是 |
| `/reminders` | 提醒列表 | 是 |
| `/runs` | Agent 执行记录列表 | 是 |
| `/runs/[id]` | Agent 执行记录详情 | 是 |
| `/settings` | 设置页 | 是 |

可选：

| 路由 | 页面 | 说明 |
|---|---|---|
| `/auth/checking` | Auth Checking | 也可以用根布局 loading 代替 |
| `/about` | 关于页 | 第一轮可以不做独立页，在设置页内展示关于信息 |

---

## 6. 认证与会话实现

### 6.1 前端 session

推荐第一轮使用 `localStorage` 保存 session：

```json
{
  "userId": "user_home_a",
  "username": "home_a",
  "displayName": "家庭成员 A",
  "householdId": "household_default",
  "householdName": "我的家"
}
```

key 建议：

```text
homecare_session
```

不要在 localStorage 保存明文密码。

### 6.2 登录逻辑

登录规则：

```text
输入 home_a / home123456 → 登录成功
输入 home_b / home123456 → 登录成功
其他账号或密码 → 登录失败，统一提示：账号名或密码错误
```

登录成功后跳转 `/`。

未登录访问受保护路由时跳转 `/login`。

已登录访问 `/login` 时跳转 `/`。

退出登录：

```text
点击设置页「退出登录」
→ 清除 homecare_session
→ 跳转 /login
→ 不清除家庭设备数据
```

---

## 7. 数据模型范围

### 7.1 最小数据表 / 实体

无论使用真实数据库还是本地 mock，都应按以下模型组织。

#### User

```ts
interface User {
  id: 'user_home_a' | 'user_home_b';
  username: 'home_a' | 'home_b';
  displayName: string;
  householdId: 'household_default';
}
```

#### Household

```ts
interface Household {
  id: 'household_default';
  name: '我的家';
}
```

#### Device

```ts
interface Device {
  id: string;
  householdId: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  purchaseDate?: string;
  warrantyMonths?: number;
  warrantyExpireDate?: string;
  warrantyStatus: 'active' | 'expiring' | 'expired' | 'unknown';
  serialNumber?: string;
  purchaseChannel?: string;
  createdByUserId: string;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### Attachment

```ts
interface Attachment {
  id: string;
  householdId: string;
  deviceId?: string;
  filename: string;
  mimeType: string;
  fileType: 'image' | 'pdf' | 'other';
  url?: string;
  parseStatus: 'pending' | 'uploaded' | 'parsing' | 'parsed' | 'failed';
  parseSummary?: string;
  createdByUserId: string;
  createdAt: string;
}
```

#### Reminder

```ts
interface Reminder {
  id: string;
  householdId: string;
  deviceId?: string;
  type: 'warranty_expire' | 'maintenance' | 'filter_replace' | 'custom';
  title: string;
  dueDate: string;
  status: 'pending' | 'done' | 'ignored';
  createdByUserId: string;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### AgentRun

```ts
interface AgentRun {
  id: string;
  householdId: string;
  createdByUserId: string;
  intent: 'create_device' | 'manual_qa' | 'warranty_check' | 'troubleshooting' | 'unknown';
  userInput: string;
  status: 'running' | 'waiting_confirmation' | 'completed' | 'failed' | 'cancelled';
  deviceId?: string;
  resultType?:
    | 'device_draft'
    | 'device_create_success'
    | 'manual_answer'
    | 'manual_not_found'
    | 'warranty_check_result'
    | 'troubleshooting_result'
    | 'safety_blocked'
    | 'error';
  resultPayload?: unknown;
  nodePath: AgentRunNode[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentRunNode {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  endedAt?: string;
  summary?: string;
}
```

#### FaultRecord

```ts
interface FaultRecord {
  id: string;
  householdId: string;
  deviceId: string;
  agentRunId?: string;
  title: string;
  symptom: string;
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  serviceScript?: string;
  createdByUserId: string;
  createdAt: string;
}
```

---

## 8. API 契约范围

第一轮推荐至少提供以下 API。可以先由 mock service 返回固定数据，再逐步替换成真实后端。

### 8.1 Auth

```http
POST /auth/login
GET /auth/me
POST /auth/logout
```

#### POST /auth/login

Request:

```json
{
  "username": "home_a",
  "password": "home123456"
}
```

Success:

```json
{
  "user": {
    "id": "user_home_a",
    "username": "home_a",
    "displayName": "家庭成员 A",
    "householdId": "household_default",
    "householdName": "我的家"
  },
  "token": "mock-session-token"
}
```

Error:

```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "账号名或密码错误"
}
```

### 8.2 Devices

```http
GET /devices
GET /devices/:id
POST /devices
PATCH /devices/:id
```

查询设备列表时只返回 `household_default` 下的数据。

### 8.3 Attachments

```http
POST /attachments
GET /attachments/:id
GET /devices/:id/attachments
```

第一轮文件内容解析可 mock，但上传状态必须能驱动 UI。

### 8.4 Reminders

```http
GET /reminders
PATCH /reminders/:id
```

PATCH 用于：

```text
标记完成
忽略
```

### 8.5 Agent Runs

```http
POST /agent/runs
GET /agent/runs
GET /agent/runs/:id
POST /agent/runs/:id/confirm
POST /agent/runs/:id/cancel
```

`POST /agent/runs` 根据用户输入和上下文生成 AgentRun。

`POST /agent/runs/:id/confirm` 用于确认设备草稿、保存故障记录等需要用户确认的写入。

### 8.6 Settings

```http
GET /settings
PATCH /settings
```

第一轮设置可以大部分为静态，但设置页必须展示当前账号、家庭空间、退出登录、数据导出入口说明。

---

## 9. Agent 工作流设计

### 9.1 总流程

LangGraph 第一轮需要有真实图结构，但节点内部可以调用 mock tool。

推荐节点：

```text
input_normalize
→ intent_classify
→ resolve_device_context
→ safety_check
→ route_by_intent
  → create_device_flow
  → manual_qa_flow
  → warranty_check_flow
  → troubleshooting_flow
→ render_result
→ persist_agent_run
```

### 9.2 create_device_flow

```text
用户上传订单 / 发票 / 说明书 / 保修卡
→ mock_extract_device_fields
→ 生成 DeviceDraft
→ resultType = device_draft
→ status = waiting_confirmation
→ 前端展示草稿确认卡
→ 用户确认
→ 创建设备
→ 绑定附件
→ 计算保修状态
→ 创建保修提醒
→ resultType = device_create_success
→ status = completed
```

注意：Agent 不得绕过用户确认直接写入设备。

### 9.3 manual_qa_flow

```text
用户提问说明书问题
→ 判断设备上下文
→ 若设备不明确，返回设备选择态
→ 若设备没有说明书，返回 manual_no_manual
→ mock_retrieve_manual_chunks
→ 若没有命中来源，返回 manual_not_found
→ 若命中来源，返回 manual_answer + sources
```

规则：

- 有来源才回答具体步骤。
- 没有来源时不要用模型常识补答案。
- 成功答案必须能打开来源详情。

### 9.4 warranty_check_flow

```text
用户询问保修
→ 判断设备上下文
→ 读取 purchaseDate 和 warrantyMonths
→ 计算 warrantyExpireDate
→ 计算 warrantyStatus
→ 返回 warranty_check_result
```

状态规则：

```text
无 purchaseDate 或无 warrantyMonths → unknown
当前日期 > warrantyExpireDate → expired
距离过保 <= 30 天 → expiring
其他 → active
```

### 9.5 troubleshooting_flow

```text
用户描述故障
→ 判断设备上下文
→ safety_check
→ 高风险：返回 safety_blocked
→ 普通风险：返回 troubleshooting_result
→ 用户确认后可保存 fault_record
```

高风险关键词示例：

```text
漏电
电击
燃气味
煤气味
明火
冒烟
爆炸
电池鼓包
电池发烫
带电拆机
短路
高压
烧焦味
```

高风险响应必须保守：

```text
停止使用
断电 / 远离现场
联系官方售后或专业人员
不提供带电维修、燃气维修、复杂拆机步骤
```

---

## 10. Figma 对应范围

编码时按以下 Figma 画板还原主要状态：

### 登录

```text
00A Login
00A-1 Login Error
00A-2 Auth Checking
```

### Agent 主线

```text
01 Agent Home / Idle
DFX 01B Agent / Upload Action Sheet
DFX 01C Upload / File States
02 Agent / Create Device Confirmation
02B Agent / Device Draft Fields Sheet
DFX 02C Agent / Device Selection
DFX 02D Agent / Execution Process Sheet
DFX 02E Agent / Device Create Success
DFX 02F Agent / Device Draft Edit Sheet
```

### 设备与业务结果

```text
04 Device Library
05 Device Detail
DFX 05B Agent / Warranty Check Result
03 Agent / Troubleshooting Result
03B Agent / Service Script Sheet
DFX 03C Agent / Save Fault Record Confirmation
DFX 06 Agent / Manual QA No Manual
DFX 06B Agent / Manual Answer Not Found
DFX 06C Agent / Manual Answer Success
DFX 06D Agent / Manual Source Sheet
```

### 管理页面

```text
DFX 00B App Shell / SideDrawer Open
DFX 00C App Shell / Drawer Item Selected
DFX 07 Reminders
DFX 08 Agent Run List
DFX 08 Agent Run Detail
DFX 09 Settings
DFX 10 Attachment Preview
```

注意：左侧抽屉不展示「数据导出」独立入口。数据导出在设置页。

---

## 11. 第一轮必须补的轻量设计状态

以下状态不一定都需要新 Figma 画板，但编码时必须有 UI 处理。

### 11.1 Agent Home 空家庭状态

当家庭空间没有设备时，Agent Home 应展示首次建档引导：

```text
还没有设备
上传订单、发票、保修卡或说明书，HomeCare Agent 会帮你生成设备档案。
```

操作入口：

```text
拍照建档
上传文件
手动添加设备
```

### 11.2 设备库空状态 / 搜索无结果

需要处理：

```text
没有设备
没有匹配搜索结果
```

### 11.3 高风险安全响应

即使 Figma 未单独补画板，代码中也必须有 `HighRiskSafetyCard`。

### 11.4 失败状态

至少需要处理：

```text
登录失败
上传失败
Agent run 失败
保存失败
加载失败
空数据
```

---

## 12. Mock Seed 数据

第一轮请准备固定 seed data，确保前端每个页面都有可展示数据。

### 12.1 用户与家庭

```text
家庭空间：我的家 / household_default
账号：home_a / home_b
```

### 12.2 设备

至少准备 4 台设备：

| 设备 | 状态 | 用途 |
|---|---|---|
| 小米净水器 S1 | 保修中 | 建档成功、说明书问答、保修查询 |
| 石头扫地机器人 P10 | 即将过保 | 设备库筛选、提醒 |
| 戴森吸尘器 V12 | 已过保 | 过保状态、故障售后 |
| 西门子洗衣机 | 未知 | 信息缺失、故障风险场景 |

### 12.3 附件

```text
订单截图.jpg
说明书.pdf
保修卡.jpg
故障照片.jpg
```

### 12.4 提醒

```text
净水器滤芯更换提醒
扫地机器人保修即将到期
吸尘器清洁提醒
```

### 12.5 Agent Runs

需要覆盖：

```text
等待确认：上传订单截图 + 说明书
已完成：净水器漏水排查
已完成：滤芯清洗问答
失败：保修查询失败
```

---

## 13. 分阶段执行计划

### Phase 0：项目初始化

目标：项目可启动，基础工程架构稳定。

任务：

1. 初始化 monorepo 或前后端目录。
2. 初始化 Next.js + TypeScript + Tailwind。
3. 初始化 FastAPI。
4. 建立共享类型或 API schema 约定。
5. 配置 lint、format、env 示例。
6. 建立基础 README。

完成标准：

```text
前端可 npm/pnpm 启动
后端可 uvicorn 启动
README 写清启动方式
```

---

### Phase 1：Auth 与 App Shell

目标：用户可以登录、保持登录态、退出登录，并进入移动端应用壳。

任务：

1. 实现 `/login`。
2. 实现登录错误态。
3. 实现 Auth Checking。
4. 实现 localStorage session。
5. 实现 AuthGuard。
6. 实现 AppShell。
7. 实现顶部栏。
8. 实现左侧抽屉。
9. 实现设置页账户信息和退出登录。

完成标准：

```text
home_a 可登录
home_b 可登录
错误账号提示账号名或密码错误
刷新后保持登录
退出登录回到登录页
未登录不能访问业务页
两个账号进入同一个家庭空间
```

---

### Phase 2：Mock Data 与基础 API

目标：设备、提醒、执行记录等核心数据能被统一读取。

任务：

1. 建立 mock seed data。
2. 实现 API client。
3. 实现 devices 查询。
4. 实现 reminders 查询。
5. 实现 agent runs 查询。
6. 实现 settings 查询。
7. 保证所有数据使用 `household_default`。
8. 保留 created_by / updated_by 字段。

完成标准：

```text
设备库能看到 seed 设备
提醒页能看到 seed 提醒
执行记录列表能看到 seed runs
设置页能看到当前账号与我的家
```

---

### Phase 3：Agent Home 与上传入口

目标：Agent 首页和上传入口可交互。

任务：

1. 实现 Agent Home。
2. 实现空家庭状态。
3. 实现快捷建议卡片。
4. 实现底部 Composer。
5. 实现 UploadActionSheet。
6. 实现 FileStateList。
7. 实现上传中、解析中、解析失败状态。
8. 文件解析结果先使用 mock。

完成标准：

```text
点击 + 可打开上传 Sheet
可展示上传文件状态
失败文件可显示重新上传 / 手动添加 / 仅保存附件
Composer 不遮挡底部内容
```

---

### Phase 4：自动建档主链路

目标：完成 create_device 闭环。

任务：

1. 实现 `POST /agent/runs` 的 create_device mock flow。
2. 生成 device_draft result。
3. 展示 DeviceDraftCard。
4. 实现查看全部字段 Sheet。
5. 实现 DeviceDraftEditSheet。
6. 实现确认创建设备。
7. 创建 Device。
8. 绑定 Attachment。
9. 计算 Warranty。
10. 创建 Reminder。
11. 展示 DeviceCreateSuccessCard。
12. 写入 AgentRun 记录。

完成标准：

```text
上传资料后生成设备草稿
用户可编辑草稿
用户确认后创建设备
设备出现在设备库
设备详情可打开
执行记录可看到本次建档 run
```

---

### Phase 5：设备库与设备详情

目标：核心设备管理页面可用。

任务：

1. 实现设备库。
2. 实现搜索。
3. 实现筛选：全部 / 保修中 / 即将过保 / 已过保 / 未知。
4. 实现设备库空状态。
5. 实现搜索无结果。
6. 实现设备详情。
7. 展示基础信息、保修、附件、提醒、维修记录入口。
8. 设备详情快捷入口：问说明书、故障售后。

完成标准：

```text
设备列表可搜索和筛选
点击设备进入详情
设备详情第一屏展示关键设备信息
底部 Composer 不遮挡核心内容
```

---

### Phase 6：说明书问答

目标：实现 manual_qa 的可信来源回答。

任务：

1. 实现设备上下文判断。
2. 无设备上下文时展示设备选择态。
3. 无说明书时展示 No Manual。
4. 有说明书但未命中时展示 Not Found。
5. 命中 mock source 时展示 ManualAnswerCard。
6. 实现 ManualSourceSheet。
7. 写入 AgentRun。

完成标准：

```text
说明书问答成功时有来源
点击来源可查看片段
没有来源时不编造答案
无说明书时引导上传说明书
```

---

### Phase 7：保修查询

目标：实现 warranty_check。

任务：

1. 实现设备选择。
2. 实现保修状态计算。
3. 展示 WarrantyResultCard。
4. 对 active / expiring / expired / unknown 都有展示。
5. 写入 AgentRun。

完成标准：

```text
保修中显示截止日期
即将过保显示剩余天数
已过保显示过保日期
未知提示补充购买日期或保修期
```

---

### Phase 8：故障售后与安全边界

目标：实现 troubleshooting 与高风险拒答。

任务：

1. 实现故障意图识别 mock。
2. 实现 safety_check。
3. 普通风险展示 TroubleshootingResultCard。
4. 高风险展示 HighRiskSafetyCard。
5. 实现 ServiceScriptSheet。
6. 实现 SaveFaultRecordConfirmation。
7. 确认后保存 FaultRecord。
8. 写入 AgentRun。

完成标准：

```text
普通故障给排查步骤和售后文案
高风险故障不提供危险维修步骤
保存故障记录必须二次确认
保存后设备详情可看到维修记录摘要
```

---

### Phase 9：提醒与执行记录

目标：低频管理页面完整可用。

任务：

1. 实现提醒列表。
2. 实现提醒筛选。
3. 实现查看设备。
4. 实现标记完成。
5. 实现忽略。
6. 实现 AgentRunList。
7. 实现 AgentRunDetail。
8. 展示节点路径、状态、结果摘要、错误信息。

完成标准：

```text
提醒可完成 / 忽略
执行记录列表可查看历史 run
执行记录详情可看到节点路径
失败 run 可看到错误摘要
```

---

### Phase 10：收尾、测试与验收

目标：达到可演示、可交给用户验收的 v0.1。

任务：

1. 按测试用例跑核心路径。
2. 修复移动端布局问题。
3. 修复底部 Composer 遮挡问题。
4. 修复空状态和错误状态。
5. 检查无底部五 Tab。
6. 检查左侧抽屉不含数据导出独立入口。
7. 检查数据导出只在设置页。
8. 检查两个账号共享同一套数据。
9. 检查高风险安全响应。
10. 更新 README 和运行说明。

完成标准：

```text
可本地启动
可登录
可完成自动建档闭环
可问说明书
可查保修
可走故障售后
可查看设备库 / 设备详情 / 提醒 / 执行记录 / 设置
测试用例主路径通过
```

---

## 14. 编码优先级

### 第一优先级：必须先完成

```text
Auth
App Shell
Mock Data
Agent Home
create_device 主链路
设备库
设备详情
AgentRun 记录
```

### 第二优先级：完成 MVP 闭环

```text
manual_qa
warranty_check
troubleshooting
high-risk safety
reminders
settings logout
```

### 第三优先级：体验补齐

```text
上传失败恢复
空状态
搜索无结果
执行失败详情
草稿编辑校验
附件预览
```

不要在第一轮插入：

```text
注册
真实 OCR
复杂 RAG
多家庭
权限系统
系统推送
真实售后工单
```

---

## 15. UI 实现约束

编码 Agent 实现 UI 时必须遵守：

- 移动端单栏。
- 不做底部 Tab。
- 左侧抽屉负责低频导航。
- 底部 Composer 固定，但不得遮挡结果卡片主要操作。
- 所有底部 Sheet 需要有 overlay、grabber、关闭按钮。
- 关键写入必须确认。
- 图标使用 SVG / icon component，不使用文字字符伪造箭头、对勾、关闭等 icon。
- 不使用 emoji 作为功能 icon。
- 主要按钮使用黑色，危险操作使用红色语义样式。
- 登录页不展示注册、忘记密码、第三方登录。

---

## 16. 验收主路径

编码完成后至少验证以下路径。

### 16.1 登录路径

```text
打开应用
→ 未登录进入 /login
→ 输入 home_a / home123456
→ 登录成功进入 Agent Home
→ 刷新页面仍保持登录
→ 进入设置页
→ 点击退出登录
→ 回到登录页
```

### 16.2 双账号共享路径

```text
home_a 登录
→ 创建设备 A
→ 退出登录
→ home_b 登录
→ 在设备库看到设备 A
→ 修改设备 A
→ 退出登录
→ home_a 登录
→ 看到 home_b 修改后的设备 A
```

### 16.3 自动建档路径

```text
Agent Home 点击上传
→ 选择订单截图 / 说明书
→ 展示上传和解析状态
→ 生成设备草稿
→ 用户编辑字段
→ 用户确认创建
→ 展示建档成功
→ 设备出现在设备库
→ 执行记录出现本次 run
```

### 16.4 说明书问答路径

```text
进入设备详情
→ 点击问说明书
→ 问“滤芯怎么清洗”
→ 返回说明书答案
→ 点击查看来源
→ 展示来源片段
```

### 16.5 保修查询路径

```text
问“这台设备还在保修吗”
→ 选择设备或使用当前设备上下文
→ 返回保修状态
→ 展示购买日期、保修期、保修截止日
```

### 16.6 故障售后路径

```text
问“净水器漏水怎么办”
→ 返回普通排查步骤
→ 查看售后沟通文案
→ 点击保存故障记录
→ 二次确认
→ 保存成功
```

### 16.7 高风险安全路径

```text
问“洗衣机漏电我能不能拆开修”
→ 系统识别高风险
→ 不提供拆修步骤
→ 提示停止使用、断电、联系专业人员
```

---

## 17. 交付物

编码 Agent 最终需要交付：

```text
可运行前端应用
可运行后端服务或 mock API
README 启动说明
.env.example
seed/mock 数据
核心 API 契约说明
核心测试说明
```

README 必须包含：

```text
如何启动前端
如何启动后端
测试账号
当前 mock 能力边界
哪些能力是 v0.1 暂不做
```

---

## 18. 最终成功标准

HomeCare Agent v0.1 第一轮编码成功的标准：

```text
用户可以用两个预置账号之一登录。
两个账号进入同一个家庭空间。
用户可以通过移动端 Agent 主界面上传资料并生成设备草稿。
用户确认后可以创建设备。
用户可以查看设备库和设备详情。
用户可以问说明书，系统有来源才回答。
用户可以查询保修，系统真实计算保修状态。
用户可以进行普通故障排查。
高风险维修请求会被安全拒答。
用户可以查看提醒和 Agent 执行记录。
用户可以退出登录。
系统没有注册、多家庭、角色权限、底部五 Tab、危险维修指导等超范围能力。
```

---

## 19. 给编码 Agent 的执行提醒

请按阶段实现，不要跳过 Auth / App Shell / Mock Data 直接写复杂 Agent。

推荐顺序：

```text
先跑通登录
再跑通移动端壳
再跑通 seed 数据
再跑通 create_device
再补 manual_qa / warranty_check / troubleshooting
最后补提醒、执行记录、设置和验收细节
```

每完成一个 Phase，都应保证应用可启动、主路径不崩、页面没有明显遮挡或空白。

