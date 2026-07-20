# 🌿 自然探索家 · Nature Explorer（动态版）

把**旅行**与**自然科普**结合的动态网页应用。通过实时位置识别当地特有/常见的植物与动物（尤其是鸟类），在一张《动物森友会》风格的可爱地图上收集属于你的自然图鉴 —— 像旅行途中「集章打卡」。**支持账号登录与云端多端同步**。

> UI 基于 [`animal-island-ui`](https://github.com/guokaigdg/animal-island-ui) 组件库（动物森友会风格，CC BY-NC 4.0，仅限非商业使用）。

---

## ✨ 功能一览

| 功能 | 说明 |
| --- | --- |
| 🗺️ 地图主界面 | 自动定位，把周边动植物撒在可爱风地图上，点击查看。 |
| 🔍 实时物种识别 | 接入 [iNaturalist](https://www.inaturalist.org/) 全球开放生物数据库。 |
| 📖 图鉴收集（集章） | 收集物种、集章式收藏册、庆祝动画。 |
| ☁️ 账号 + 云端同步 | Supabase 邮箱登录 + Google/GitHub SSO，图鉴多端同步。 |
| 💬 AI 自然向导 | 内置对话，结合当前物种与位置科普答疑。 |
| 🌐 离线降级 | 未配置云端/断网时自动退回本地模式，功能不中断。 |

---

## 🚀 快速开始

```bash
npm install
npm run dev      # 打开 http://localhost:5173
```

不配置任何东西也能直接玩（本地模式）。要开启**账号 + 云端同步**，请跟着
👉 [`SETUP-中文教程.md`](./SETUP-中文教程.md)（保姆级，不懂技术也能做）。

---

## 🛠️ 技术栈

- **框架**：Vite + React 18 + TypeScript
- **UI**：animal-island-ui（动物森友会风格组件库）
- **地图**：Leaflet + CartoDB Voyager 瓦片
- **生物数据**：iNaturalist API（含中文名、维基简介）
- **地名**：OpenStreetMap Nominatim
- **后端 / 账号 / 数据库**：Supabase（Postgres + Auth，含 RLS 行级安全）
- **AI**：任意 OpenAI 兼容接口（可选，含离线降级）

---

## 🗂️ 项目结构

```
nature-explorer-react/
├── index.html
├── .env.example              # 环境变量示例（复制为 .env.local 填写）
├── supabase/
│   └── schema.sql            # 数据库建表 + RLS 安全策略
├── SETUP-中文教程.md          # 保姆级配置教程
└── src/
    ├── main.tsx              # 入口（先 import animal-island-ui/style）
    ├── App.tsx               # 主控制器，组装所有模块
    ├── index.css             # 页面级布局（沿用组件库设计 token）
    ├── types.ts / constants.ts
    ├── lib/supabase.ts       # Supabase 客户端
    ├── contexts/AuthContext.tsx  # 登录状态 + 邮箱/SSO 登录
    ├── services/
    │   ├── inaturalist.ts    # 物种 API + 反向地理编码
    │   ├── ai.ts             # AI 对话（真实 API + 离线）
    │   └── collection.ts     # 图鉴（云端 + 本地降级 + 合并）
    └── components/
        ├── AuthPage.tsx      # 登录/注册页
        ├── MapView.tsx       # Leaflet 地图
        ├── SpeciesCard.tsx   # 物种卡片
        ├── SpeciesDetailModal.tsx # 物种详情
        ├── CollectionDrawer.tsx   # 图鉴收藏册
        ├── AIDrawer.tsx      # AI 对话面板
        └── UserDrawer.tsx    # 用户菜单
```

---

## 📌 数据同步逻辑

- **未登录**：图鉴存 `localStorage`（本机）。
- **登录后**：图鉴读写 Supabase 云端表；登录瞬间会把本地已收集的**自动合并上云**，不丢收藏。
- **多端**：任意设备登录同一账号，图鉴一致。

---

## ⚖️ 授权说明

- 本项目 UI 基于 `animal-island-ui`，其授权为 **CC BY-NC 4.0（禁止商业使用）**。
- 请仅用于**个人学习 / 兴趣 / 非商业**用途。若将来商业化，需替换 UI 库。
- 物种数据来自 iNaturalist 社区的公民科学贡献。

---

_愿你在每一次旅行中，都能重新认识脚下的自然。🌏_
