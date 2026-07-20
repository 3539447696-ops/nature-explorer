# 🐣 保姆级配置教程（不懂技术也能跟着做）

本教程带你一步步把「自然探索家」跑起来，并开启**云端账号 + 图鉴多端同步**。
全程免费，不需要买服务器。预计 15 分钟。

---

## 第一步：安装运行环境（只做一次）

1. 打开 [Node.js 官网](https://nodejs.org/)，下载 **LTS 版本**并安装（一路点“下一步”即可）。
2. 安装完成后，打开电脑的「终端」（Mac）或「命令提示符」（Windows）。

---

## 第二步：启动项目（先看到画面）

在终端里依次输入（每行回车执行）：

```bash
cd 到你存放 nature-explorer-react 的目录
npm install
npm run dev
```

- `npm install` 会自动下载所有依赖（含 animal-island-ui、Supabase 等），第一次会慢一点。
- 完成后浏览器会自动打开 `http://localhost:5173`。

> 此时即使**还没配置云端**，也能正常玩：地图、识别动植物、AI 对话、图鉴收集都能用，只是图鉴暂存在本机。

---

## 第三步：创建免费的 Supabase 项目（开启账号 + 云端同步）

1. 打开 [https://supabase.com](https://supabase.com)，用 GitHub 或邮箱**免费注册并登录**。
2. 点击 **New Project**（新建项目）：
   - Name：随便起，比如 `nature-explorer`
   - Database Password：设置一个数据库密码（自己记住即可，前端用不到）
   - Region：选离你近的（如 Southeast Asia / Singapore）
   - 点 **Create new project**，等待 1-2 分钟初始化完成。

---

## 第四步：建数据库表（复制粘贴即可）

1. 在 Supabase 项目里，点左侧菜单的 **SQL Editor**。
2. 点 **+ New query**。
3. 打开本项目的 [`supabase/schema.sql`](./supabase/schema.sql)，**全选复制**里面所有内容。
4. 粘贴到 SQL 编辑器里，点右下角 **Run**（运行）。
5. 看到 “Success” 就表示表建好了 ✅

---

## 第五步：拿到你的钥匙并填进项目

1. 在 Supabase 项目里，点左下角 **Project Settings（齿轮）→ API**。
2. 你会看到两样东西：
   - **Project URL**（形如 `https://abcdefg.supabase.co`）
   - **anon public** 这一栏的 key（很长一串）
3. 回到项目文件夹，把 [`.env.example`](./.env.example) **复制一份**并重命名为 `.env.local`。
4. 用记事本打开 `.env.local`，把上面两样填进去：

```
VITE_SUPABASE_URL=https://abcdefg.supabase.co
VITE_SUPABASE_ANON_KEY=粘贴你的 anon public key
```

5. 保存文件。回到终端按 `Ctrl + C` 停止，再次运行 `npm run dev`。

现在刷新页面，就会看到**登录/注册**界面了 🎉 用邮箱注册一个账号即可。

---

## 第六步（可选）：开启第三方登录（Google / GitHub）

想让用户用 Google / GitHub 一键登录：

1. Supabase 项目 → 左侧 **Authentication → Providers**。
2. 找到 **Google** 或 **GitHub**，打开开关，按页面提示填入对应平台的 Client ID / Secret。
   - Google：到 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 凭据
   - GitHub：到 GitHub → Settings → Developer settings → OAuth Apps 创建
3. 回调地址填 Supabase 页面上给出的那一串（形如 `https://abcdefg.supabase.co/auth/v1/callback`）。
4. 保存后，登录页的「Google / GitHub」按钮就能用了。

> 只用邮箱登录的话，这一步可以跳过。

---

## 第七步（可选）：开启 AI 智能对话

默认 AI 向导使用**内置离线问答**（能答常见科普问题）。想解锁完整智能对话：

在 `.env.local` 里补充（任意 OpenAI 兼容接口）：

```
VITE_AI_BASE_URL=https://api.openai.com/v1
VITE_AI_API_KEY=你的密钥
VITE_AI_MODEL=gpt-4o-mini
```

保存并重启 `npm run dev` 即可。

---

## 第八步（可选）：发布到公网，让手机 / 朋友访问

推荐用 **Vercel**（免费）：

1. 把项目上传到 GitHub。
2. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录，**Import** 你的仓库。
3. 在 Vercel 项目的 **Settings → Environment Variables** 里，把 `.env.local` 里的那几个变量也填一遍。
4. 点 Deploy，几分钟后就得到一个公网网址，手机、朋友都能打开。
5. 记得回到 Supabase → Authentication → URL Configuration，把 Vercel 给的网址加到 **Site URL / Redirect URLs**，第三方登录跳转才正常。

---

## 常见问题

**Q：不配置 Supabase 能用吗？**
能。不配置就是“本地模式”，所有功能都能玩，只是图鉴存在本机、没有账号。

**Q：定位不生效？**
浏览器需要 `http://localhost` 或 `https://` 才允许定位；用 `npm run dev` 打开就没问题。首次会弹权限请求，点“允许”。

**Q：anon key 放前端安全吗？**
安全。它是“公开密钥”，真正的数据隔离由数据库的 RLS 策略保证（第四步的 SQL 已经配好），每个用户只能读写自己的数据。
