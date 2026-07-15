# 数据看板 — 需求澄清与设计方案

> 版本: v0.1-draft  
> 日期: 2026-07-15  
> 状态: 待确认

---

## 1. 需求概述

开发一个数据看板系统，包含两部分：

| 组件 | 说明 |
|------|------|
| **定时脚本** | 每日 10:00 自动执行，连接线上数据库，查询任务创建/执行情况（成功、失败、执行中、暂停、取消等状态），汇总成功率并分析失败原因 |
| **看板页面** | 在 iMoney 记账小程序内新增数据看板 Tab/页面，以图表形式展示任务成功率趋势、状态分布、失败原因分析 |

---

## 2. 关键假设（待确认）

| # | 假设 | 风险等级 | 影响 |
|---|------|---------|------|
| H1 | 任务数据存储在 MySQL 关系型数据库中 | 中 | 决定脚本的数据库连接方式和查询语法 |
| H2 | 任务表结构包含字段：`id`, `task_name`, `status`, `created_at`, `updated_at`, `error_message` | 高 | 直接影响查询逻辑和失败原因分析字段 |
| H3 | 数据库 IP 和凭证可通过环境变量配置 | 低 | 脚本安全设计的基础 |
| H4 | 看板嵌入 iMoney 小程序现有页面路由体系 | 低 | 决定前端路由和导航结构 |
| H5 | 每日 10:00 的 cron 触发由服务器 crontab 管理 | 低 | 脚本调度方式 |
| H6 | 看板只需展示数据，不需要实时操作/重试任务 | 中 | 决定前端交互复杂度 |

---

## 3. 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    服务器 (每日 10:00)                 │
│  ┌───────────────┐    ┌──────────────────────────┐   │
│  │  crontab      │───▶│  Node.js 脚本              │   │
│  │  0 10 * * *   │    │  - 连接 MySQL              │   │
│  └───────────────┘    │  - 查询昨日任务数据          │   │
│                        │  - 计算成功率               │   │
│                        │  - 分析失败原因              │   │
│                        │  - 写入汇总表               │   │
│                        └──────────┬───────────────┘   │
│                                   │                   │
│                         ┌─────────▼───────────────┐   │
│                         │  MySQL 汇总表             │   │
│                         │  dashboard_daily_report  │   │
│                         └─────────┬───────────────┘   │
└───────────────────────────────────┼───────────────────┘
                                    │ API 查询
┌───────────────────────────────────┼───────────────────┐
│                      iMoney 小程序                      │
│  ┌────────────────────────────────▼────────────────┐  │
│  │              数据看板页面                         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │ 成功率    │ │ 状态分布  │ │ 失败原因分析     │ │  │
│  │  │ 趋势图    │ │ 饼图      │ │ 排行榜/柱状图   │ │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 4. 数据流设计

### 4.1 脚本执行流程

```
1. crontab 触发 (每日 10:00)
2. 脚本读取环境变量 (DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME)
3. 连接 MySQL 数据库
4. 执行查询：
   - 查询昨日 (T-1) 所有任务记录
   - 按 status 分组统计
   - 提取失败任务的 error_message
5. 计算指标：
   - 成功率 = success_count / total_count
   - 各状态数量及占比
   - 失败原因 Top N
6. 写入汇总表 dashboard_daily_report
7. 关闭连接，输出日志
```

### 4.2 数据库表设计

**源表（假设已存在）**：`task`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| task_name | VARCHAR | 任务名称 |
| task_type | VARCHAR | 任务类型 |
| status | ENUM | pending / running / success / failed / paused / cancelled |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |
| error_message | TEXT | 失败原因 |
| retry_count | INT | 重试次数 |

**汇总表（新建）**：`dashboard_daily_report`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| report_date | DATE | 报告日期 |
| total_count | INT | 任务总数 |
| success_count | INT | 成功数 |
| failed_count | INT | 失败数 |
| running_count | INT | 执行中数 |
| paused_count | INT | 暂停数 |
| cancelled_count | INT | 取消数 |
| success_rate | DECIMAL(5,2) | 成功率 (%) |
| top_failure_reasons | JSON | 失败原因 Top 5 |
| created_at | DATETIME | 生成时间 |

### 4.3 API 设计

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/dashboard/summary?date=2026-07-14` | GET | 获取指定日期的汇总数据 |
| `/api/dashboard/trend?days=30` | GET | 获取近 N 天的成功率趋势 |
| `/api/dashboard/failures?date=2026-07-14` | GET | 获取指定日期的失败详情 |

---

## 5. 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| 脚本运行环境 | Node.js (v18+) | 与项目技术栈一致，mysql2 驱动成熟 |
| 数据库驱动 | mysql2 | 支持 Promise API，性能好 |
| 定时调度 | Linux crontab | 最简单可靠，无需额外依赖 |
| 前端框架 | Taro + React + TypeScript | 与现有项目一致 |
| 图表库 | ECharts (echarts-for-taro) | 微信小程序兼容，图表类型丰富 |
| 样式 | Less | 与现有项目一致 |

---

## 6. 页面设计

### 6.1 看板页面布局

```
┌──────────────────────────────────┐
│  数据看板                    ⚙️  │  ← 导航栏
├──────────────────────────────────┤
│  ┌────────────────────────────┐  │
│  │  日期选择器: [2026-07-14]  │  │  ← 日期筛选
│  └────────────────────────────┘  │
│  ┌──────────┐ ┌──────────────┐  │
│  │ 成功率    │ │ 任务总数      │  │  ← 指标卡片
│  │ 92.5% ▲  │ │ 1,234       │  │
│  └──────────┘ └──────────────┘  │
│  ┌────────────────────────────┐  │
│  │  成功率趋势 (近30天)        │  │  ← 折线图
│  │  📈                        │  │
│  └────────────────────────────┘  │
│  ┌──────────┐ ┌──────────────┐  │
│  │ 状态分布  │ │ 失败原因 Top  │  │  ← 饼图 + 排行
│  │ 🥧        │ │ 1. 超时 30%  │  │
│  │           │ │ 2. 网络 25%  │  │
│  └──────────┘ └──────────────┘  │
└──────────────────────────────────┘
```

### 6.2 页面路由

- 路由路径：`/pages/dashboard/index`
- 入口：底部 TabBar 新增"数据"Tab 或从"我的"页面进入

### 6.3 文件结构

```
src/
├── pages/
│   └── dashboard/
│       ├── index.tsx          # 看板页面主组件
│       ├── index.config.ts    # 页面配置
│       ├── index.less         # 页面样式
│       └── components/
│           ├── SuccessRateCard.tsx    # 成功率卡片
│           ├── StatusPieChart.tsx     # 状态分布饼图
│           ├── TrendLineChart.tsx     # 趋势折线图
│           └── FailureRanking.tsx     # 失败原因排行
├── services/
│   └── dashboard.ts           # 看板 API 调用
└── types/
    └── dashboard.ts           # 看板类型定义

scripts/
└── dashboard/
    ├── daily-report.js        # 每日报告生成脚本
    ├── config.js              # 数据库配置
    └── package.json           # 脚本依赖
```

---

## 7. 脚本设计

### 7.1 核心依赖

```json
{
  "dependencies": {
    "mysql2": "^3.x",
    "dotenv": "^16.x",
    "winston": "^3.x"
  }
}
```

### 7.2 脚本伪代码

```javascript
// scripts/dashboard/daily-report.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  const yesterday = getYesterday(); // '2026-07-14'

  // 1. 按状态统计
  const [statusRows] = await conn.execute(
    `SELECT status, COUNT(*) as count FROM task
     WHERE DATE(created_at) = ?
     GROUP BY status`, [yesterday]
  );

  // 2. 失败原因分析
  const [failureRows] = await conn.execute(
    `SELECT error_message, COUNT(*) as count FROM task
     WHERE DATE(created_at) = ? AND status = 'failed'
     GROUP BY error_message ORDER BY count DESC LIMIT 5`, [yesterday]
  );

  // 3. 计算成功率
  const stats = aggregateStatus(statusRows);
  const successRate = (stats.success / stats.total * 100).toFixed(2);

  // 4. 写入汇总表
  await conn.execute(
    `INSERT INTO dashboard_daily_report
     (report_date, total_count, success_count, failed_count,
      running_count, paused_count, cancelled_count,
      success_rate, top_failure_reasons)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [yesterday, stats.total, stats.success, stats.failed,
     stats.running, stats.paused, stats.cancelled,
     successRate, JSON.stringify(failureRows)]
  );

  await conn.end();
  console.log(`[${new Date().toISOString()}] 报告生成完成: ${yesterday} 成功率 ${successRate}%`);
}

main().catch(console.error);
```

### 7.3 Cron 配置

```cron
# 每日 10:00 执行数据看板报告生成
0 10 * * * cd /path/to/scripts/dashboard && node daily-report.js >> /var/log/dashboard.log 2>&1
```

---

## 8. 待确认清单

> 以下事项在正式开发前需与需求方确认，当前按假设值推进设计。

| # | 确认事项 | 当前假设 | 影响范围 |
|---|---------|---------|---------|
| C1 | 任务表的确切表名和字段名 | 表名 `task`，字段见 §4.2 | 脚本 SQL 查询 |
| C2 | 数据库类型和版本 | MySQL 5.7+ | 驱动选择 |
| C3 | 数据库连接信息（IP、端口、库名） | 通过 `.env` 配置 | 脚本配置 |
| C4 | 看板是否需要历史趋势？ | 需要近 30 天趋势 | API 和图表设计 |
| C5 | 是否需要按任务类型分类统计？ | 暂不需要 | 页面复杂度 |
| C6 | 小程序 API 后端服务是否已有？ | 需新增 API 端点 | 后端工作量 |
| C7 | 看板入口位置 | 底部 TabBar 新增"数据"Tab | 导航结构变更 |

---

## 9. 下一步行动

1. **确认假设**：与需求方确认 §8 待确认清单
2. **数据库摸底**：获取 task 表真实 DDL，调整查询逻辑
3. **API 开发**：后端新增看板数据接口
4. **脚本开发**：编写并测试 `daily-report.js`
5. **前端开发**：Taro 看板页面 + ECharts 图表
6. **联调测试**：端到端验证数据流

---

*文档由 brainstorming 流程自动生成，版本 v0.1-draft*