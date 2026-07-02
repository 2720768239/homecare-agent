# HomeCare Agent v0.1

移动端 Agent-first PWA，帮助家庭管理家电档案、说明书问答、保修查询和故障售后。

## 快速启动

### 前端（Next.js PWA）

```bash
cd apps/web
npm install
npm run dev
# 访问 http://localhost:3000
```

### 后端（FastAPI + LangGraph）

```bash
cd apps/api
python -m venv .venv
# Windows:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -e .
uvicorn main:app --reload --port 8000
# API 文档 http://localhost:8000/docs
```

> **v0.1 默认使用 Mock 模式**：前端独立运行，无需启动后端即可体验完整功能。后端为后续真实 AI 能力预留。

## 测试账号

| 账号名 | 密码 | 姓名 | 家庭空间 |
|---|---|---|---|
| `home_a` | `home123456` | 家庭成员 A | 我的家 |
| `home_b` | `home123456` | 家庭成员 B | 我的家 |

两个账号共享同一个家庭空间 `household_default`，看到同一套设备数据。

## 产品功能

- **自动建档**：上传订单/发票/保修卡/说明书 → Agent 生成设备草稿 → 用户确认创建
- **说明书问答**：基于设备说明书回答使用方法、故障代码、保养步骤
- **保修查询**：真实计算保修状态（保修中 / 即将过保 / 已过保 / 未知）
- **故障售后**：提供排查步骤和售后文案，高风险故障保守拒答
- **设备库**：搜索、筛选、查看设备详情和附件
- **提醒管理**：保修到期提醒、滤芯更换提醒
- **Agent 执行记录**：查看每次 Agent 任务的节点路径和结果

## Mock 能力边界（v0.1）

| 能力 | v0.1 实现口径 |
|---|---|
| 登录 | Mock auth，预置账号，真实 session 保持 |
| 设备/提醒/执行记录 | localStorage 持久化（前端 mock）/ 内存（后端） |
| 文件上传 | 前端上传状态完整，文件内容解析 mock |
| OCR | Mock，返回 demo 草稿数据 |
| PDF 解析 | Mock，不阻塞主链路 |
| 说明书 RAG | Seed chunks + mock 检索 |
| LangGraph | 真实图结构骨架，节点工具结果 mock |
| **保修计算** | **真实计算**（active/expiring/expired/unknown） |
| **高风险安全判断** | **真实规则判断**（漏电/燃气味/明火/冒烟等 → 保守拒答） |
| **Agent 执行记录** | **真实记录**每次任务的状态、节点路径和结果摘要 |

## 明确不做（v0.1）

- 账号注册、忘记密码、第三方登录
- 多家庭切换、成员邀请、角色权限
- PC/Web 独立适配
- 传统底部五 Tab 导航
- 系统级推送
- 真实售后工单提交
- 自动联系售后、自动购买耗材
- 删除设备、删除附件、永久删除执行记录
- 真实 OCR、复杂 RAG、全文搜索

## 技术栈

- **前端**：Next.js 14 + TypeScript + Tailwind CSS + Zustand
- **后端**：Python FastAPI + Pydantic + LangGraph
- **数据**：PostgreSQL（规划中，v0.1 用内存/mock）
- **文件存储**：S3/MinIO（规划中，v0.1 用 mock URL）

## 项目结构

```
homecare-agent/
├── apps/
│   ├── web/              # Next.js PWA 前端
│   └── api/              # FastAPI + LangGraph 后端
├── docs/
│   └── v0.1/             # 产品/设计/技术文档
├── README.md
└── .env.example
```

## 前端路由

| 路由 | 页面 | 说明 |
|---|---|---|
| `/login` | 登录 | 预置账号登录 |
| `/` | Agent Home | 主界面，对话+快捷建议+Composer |
| `/devices` | 设备库 | 搜索筛选设备 |
| `/devices/[id]` | 设备详情 | 附件、保修、说明书入口 |
| `/reminders` | 提醒 | 保修/保养提醒 |
| `/runs` | 执行记录 | Agent 任务历史 |
| `/runs/[id]` | 执行详情 | 节点路径+结果 |
| `/settings` | 设置 | 账号、导出、退出 |

## 后端 API

| 路径 | 说明 |
|---|---|
| `POST /api/auth/login` | 登录 |
| `GET /api/devices` | 设备列表 |
| `POST /api/agent/runs` | 启动 Agent 任务 |
| `POST /api/agent/runs/{id}/confirm` | 确认操作 |
| ... | 详见 `/docs` 页面 |

## License

Internal project — v0.1 MVP
