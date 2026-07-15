# 数据看板 — 实施计划

> 版本: v1.0
> 日期: 2026-07-15
> 基于: docs/data-dashboard-design.md v0.1-draft
> 项目: iMoney 记账小程序 (Taro 4.2.0 + React + TypeScript + Less)

---

## 1. 实施概览

| 阶段 | 内容 | 预计产物 | 依赖 |
|------|------|---------|------|
| **Phase 1: 基础设施** | 数据库汇总表创建、脚本目录搭建 | DDL 脚本、目录结构 | 无 |
| **Phase 2: 脚本开发** | 每日报告生成脚本 + 配置 | `scripts/dashboard/` 全部文件 | Phase 1 |
| **Phase 3: 后端 API** | 3 个看板数据查询接口 | API 路由实现 | Phase 1 |
| **Phase 4: 前端开发** | 看板页面 + 图表组件 | `src/pages/dashboard/` 全部文件 | Phase 3 |
| **Phase 5: 联调测试** | 端到端数据流验证 | 测试报告 | Phase 2 + 4 |

---

## 2. Phase 1: 基础设施

### 2.1 数据库汇总表 DDL

**目标文件**: `scripts/dashboard/migrations/001_create_dashboard_daily_report.sql`

**产出内容**:
```sql
CREATE TABLE IF NOT EXISTS `dashboard_daily_report` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `report_date` DATE NOT NULL COMMENT '报告日期',
  `total_count` INT NOT NULL DEFAULT 0 COMMENT '任务总数',
  `success_count` INT NOT NULL DEFAULT 0 COMMENT '成功数',
  `failed_count` INT NOT NULL DEFAULT 0 COMMENT '失败数',
  `running_count` INT NOT NULL DEFAULT 0 COMMENT '执行中数',
  `paused_count` INT NOT NULL DEFAULT 0 COMMENT '暂停数',
  `cancelled_count` INT NOT NULL DEFAULT 0 COMMENT '取消数',
  `success_rate` DECIMAL(5,2) DEFAULT 0.00 COMMENT '成功率 (%)',
  `top_failure_reasons` JSON COMMENT '失败原因 Top 5',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  UNIQUE KEY `uk_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据看板每日报告';
```

### 2.2 脚本目录初始化

创建 `scripts/dashboard/` 目录结构：

```
scripts/dashboard/
├── migrations/
│   └── 001_create_dashboard_daily_report.sql
├── daily-report.js
├── config.js
├── .env.example
└── package.json
```

**验证标准**:
- [ ] DDL 语句在 MySQL 5.7+ 上可执行
- [ ] `uk_report_date` 唯一索引防止重复插入（使用 `INSERT ... ON DUPLICATE KEY UPDATE`）

---

## 3. Phase 2: 脚本开发

### 3.1 脚本入口: `daily-report.js`

**关键逻辑**:
1. 读取环境变量 → 连接 MySQL
2. 计算昨日日期 `YYYY-MM-DD`
3. 查询 `task` 表按 `status` 分组统计
4. 查询失败任务 `error_message` Top 5
5. 计算成功率 = `success / total * 100`
6. 写入 `dashboard_daily_report`（幂等：`ON DUPLICATE KEY UPDATE`）
7. 关闭连接，输出结构化日志

**边界处理**:
- 昨日无任务：`total_count = 0`，`success_rate = 0.00`，仍写入记录
- 连接失败：`process.exit(1)` 并输出错误日志
- 查询异常：`try/catch` 包裹，记录错误后退出

### 3.2 配置管理: `config.js`

```javascript
// 从环境变量读取，提供默认值
module.exports = {
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'imoney',
  },
  taskTable: process.env.TASK_TABLE || 'task',
  reportTable: 'dashboard_daily_report',
};
```

### 3.3 环境变量模板: `.env.example`

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=imoney
TASK_TABLE=task
```

### 3.4 依赖声明: `package.json`

```json
{
  "name": "dashboard-report",
  "private": true,
  "scripts": {
    "report": "node daily-report.js"
  },
  "dependencies": {
    "mysql2": "^3.12.0",
    "dotenv": "^16.4.0"
  }
}
```

### 3.5 Cron 配置

```cron
# 每日 10:00 执行
0 10 * * * cd /path/to/scripts/dashboard && node daily-report.js >> /var/log/dashboard.log 2>&1
```

**验证标准**:
- [ ] 执行 `npm run report` 可正常连接数据库并写入报告
- [ ] 重复执行同一天不产生重复记录
- [ ] 无任务时优雅降级不报错
- [ ] 错误场景输出可追踪日志

---

## 4. Phase 3: 后端 API 开发

### 4.1 接口清单

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 日汇总 | GET | `/api/dashboard/summary?date=2026-07-14` | 指定日期的汇总数据 |
| 趋势 | GET | `/api/dashboard/trend?days=30` | 近 N 天成功率趋势 |
| 失败详情 | GET | `/api/dashboard/failures?date=2026-07-14` | 指定日期的失败原因详情 |

### 4.2 响应格式

**`/api/dashboard/summary`**:
```json
{
  "code": 0,
  "data": {
    "report_date": "2026-07-14",
    "total_count": 1234,
    "success_count": 1142,
    "failed_count": 45,
    "running_count": 20,
    "paused_count": 15,
    "cancelled_count": 12,
    "success_rate": 92.55,
    "top_failure_reasons": [
      {"error_message": "timeout", "count": 18},
      {"error_message": "network error", "count": 12}
    ]
  }
}
```

**`/api/dashboard/trend?days=30`**:
```json
{
  "code": 0,
  "data": [
    {"report_date": "2026-06-15", "success_rate": 90.12, "total_count": 1100},
    {"report_date": "2026-06-16", "success_rate": 91.50, "total_count": 1150}
  ]
}
```

**`/api/dashboard/failures`**:
```json
{
  "code": 0,
  "data": {
    "report_date": "2026-07-14",
    "failed_count": 45,
    "failure_reasons": [...]
  }
}
```

### 4.3 实现说明

- API 端点在现有后端服务中新增路由（如 Express/Koa）
- 直接查询 `dashboard_daily_report` 表，无需关联源表
- 查询无数据时返回空结构而非 404

**验证标准**:
- [ ] 3 个接口均可正常返回 JSON
- [ ] 无数据时返回 `code: 0`，`data` 为合理默认值
- [ ] 日期参数校验：非法格式返回 `code: 400`

---

## 5. Phase 4: 前端开发

### 5.1 文件产出清单

```
src/
├── pages/dashboard/
│   ├── index.tsx              # 主页面组件
│   ├── index.config.ts        # 页面配置
│   ├── index.less             # 页面样式
│   └── components/
│       ├── SuccessRateCard.tsx  # 成功率卡片
│       ├── StatusPieChart.tsx   # 状态分布饼图
│       ├── TrendLineChart.tsx   # 趋势折线图
│       └── FailureRanking.tsx   # 失败原因排行
├── services/
│   └── dashboard.ts            # 看板 API 调用封装
└── types/
    └── dashboard.ts            # 看板类型定义
```

### 5.2 类型定义: `src/types/dashboard.ts`

```typescript
export interface DashboardSummary {
  report_date: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  running_count: number;
  paused_count: number;
  cancelled_count: number;
  success_rate: number;
  top_failure_reasons: FailureReason[];
}

export interface FailureReason {
  error_message: string;
  count: number;
}

export interface TrendItem {
  report_date: string;
  success_rate: number;
  total_count: number;
}

export interface DashboardFailures {
  report_date: string;
  failed_count: number;
  failure_reasons: FailureReason[];
}
```

### 5.3 API 服务: `src/services/dashboard.ts`

```typescript
import { request } from '@/utils/request'; // 假设项目已有请求封装
import type { DashboardSummary, TrendItem, DashboardFailures } from '@/types/dashboard';

export function getDashboardSummary(date: string): Promise<DashboardSummary> { ... }
export function getDashboardTrend(days: number): Promise<TrendItem[]> { ... }
export function getDashboardFailures(date: string): Promise<DashboardFailures> { ... }
```

### 5.4 页面组件: `src/pages/dashboard/index.tsx`

**页面结构**:
```
┌──────────────────────────────────┐
│  数据看板                    ⚙️  │  ← 导航栏
├──────────────────────────────────┤
│  日期选择器: [2026-07-14]        │  ← Picker 组件
├──────────────────────────────────┤
│  ┌──────────┐ ┌──────────────┐   │
│  │ 成功率    │ │ 任务总数      │   │  ← SuccessRateCard
│  │ 92.5%    │ │ 1,234        │   │
│  └──────────┘ └──────────────┘   │
├──────────────────────────────────┤
│  成功率趋势 (近30天)              │  ← TrendLineChart
│  📈 ECharts 折线图               │
├──────────────────────────────────┤
│  ┌──────────┐ ┌──────────────┐   │
│  │ 状态分布  │ │ 失败原因 Top  │   │  ← StatusPieChart + FailureRanking
│  │ 🥧 饼图   │ │ 排行列表      │   │
│  └──────────┘ └──────────────┘   │
└──────────────────────────────────┘
```

**核心逻辑**:
1. `useEffect` 初始化 → 默认选择当日日期 → 并行请求 summary + trend + failures
2. 日期变更 → 重新请求 summary + failures
3. 加载态：骨架屏/加载提示
4. 空态：无数据时展示占位提示
5. 错误态：接口失败 Toast 提示

### 5.5 图表组件实现要点

| 组件 | 图表类型 | ECharts 配置要点 |
|------|---------|-----------------|
| `TrendLineChart` | 折线图 | `xAxis` 日期，`yAxis` 成功率 0-100%，`series` 平滑曲线 |
| `StatusPieChart` | 饼图 | 按状态 (success/failed/running/paused/cancelled) 分色 |
| `FailureRanking` | 横向柱状图 | `xAxis` 数量，`yAxis` 失败原因，降序排列 |

### 5.6 路由注册

在 `src/app.config.ts` 中新增页面路由：

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/helloworld/helloworld',
    'pages/dashboard/index'  // ← 新增
  ],
  // ...
});
```

**验证标准**:
- [ ] 页面可正常渲染，组件无报错
- [ ] 日期选择器切换正常，数据联动刷新
- [ ] 加载态、空态、错误态表现正常
- [ ] 图表组件在小程序真机预览中正常显示

---

## 6. Phase 5: 联调测试

### 6.1 测试用例

| 场景 | 操作 | 期望结果 |
|------|------|---------|
| 正常流程 | 脚本执行 → API 查询 → 看板展示 | 数据一致，图表正确 |
| 无任务日 | 脚本执行当日无 task 记录 | 汇总表写入 total=0，看板展示空态 |
| 全失败 | 当日所有 task 均为 failed | 成功率 0%，失败原因正确展示 |
| 重复执行 | 脚本同一天执行两次 | 汇总表不产生重复行 |
| 日期切换 | 看板切换不同日期 | 图表数据正确刷新 |
| 接口异常 | API 返回 500 | 看板展示错误提示，不崩溃 |

### 6.2 验证命令

```bash
# 1. 脚本测试
cd scripts/dashboard && npm run report

# 2. API 测试
curl http://localhost:3000/api/dashboard/summary?date=2026-07-14
curl http://localhost:3000/api/dashboard/trend?days=30
curl http://localhost:3000/api/dashboard/failures?date=2026-07-14

# 3. 前端构建
yarn dev:weapp  # 微信小程序开发模式
```

---

## 7. 实施顺序

```
Phase 1 (基础设施)
  └─▶ Phase 2 (脚本) ──────────────────┐
  └─▶ Phase 3 (API)  ──┐               │
                        ▼               ▼
                   Phase 4 (前端)  Phase 5 (联调)
```

- **Phase 1 + 2 + 3 可并行**：基础设施、脚本、API 互不依赖
- **Phase 4 依赖 Phase 3**：前端需要 API 就绪
- **Phase 5 依赖 Phase 2 + 4**：端到端联调

---

## 8. 风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| task 表结构未知 | 高 | 先用假设结构开发，Phase 1 优先确认 DDL |
| 数据库连接信息未提供 | 中 | 使用 `.env` 配置，`.env.example` 提供模板 |
| ECharts 小程序兼容性 | 中 | 使用 `echarts-for-taro` 而非原生 ECharts |
| 后端 API 框架未明确 | 低 | 按 Express/Koa 通用模式实现，接口契约不变 |
| 看板入口位置未定 | 低 | 先作为独立页面 `/pages/dashboard/index`，入口待确认 |

---

*文档版本 v1.0，基于 design v0.1-draft 生成*