-- ============================================================
-- 自然探索家 · 数据库建表脚本
-- 使用方法：登录 Supabase 项目 → 左侧 SQL Editor → 新建查询
--          → 把本文件全部内容粘贴进去 → 点 Run 运行
-- ============================================================

-- 1) 图鉴收藏表
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  species_id  text not null,               -- 物种唯一标识（inat-<id> 或 fb-<id>）
  taxon_id    bigint,                       -- iNaturalist taxon id（可空）
  cn_name     text not null,               -- 中文名
  sci_name    text,                         -- 学名
  taxon       text,                         -- 大类（Aves/Plantae/...）
  photo       text,                         -- 图片 URL
  wiki        text,                         -- 简介
  location    text,                         -- 收集地点
  created_at  timestamptz not null default now(),
  -- 同一用户对同一物种只能收藏一次
  unique (user_id, species_id)
);

-- 加速按用户查询
create index if not exists collections_user_idx on public.collections(user_id);

-- 2) 开启行级安全（RLS）—— 这是数据安全的核心
--    确保每个用户只能读写自己的收藏，别人碰不到。
alter table public.collections enable row level security;

-- 3) 安全策略：用户只能操作 user_id = 自己 的数据
drop policy if exists "用户可查看自己的收藏" on public.collections;
create policy "用户可查看自己的收藏"
  on public.collections for select
  using (auth.uid() = user_id);

drop policy if exists "用户可新增自己的收藏" on public.collections;
create policy "用户可新增自己的收藏"
  on public.collections for insert
  with check (auth.uid() = user_id);

drop policy if exists "用户可删除自己的收藏" on public.collections;
create policy "用户可删除自己的收藏"
  on public.collections for delete
  using (auth.uid() = user_id);

drop policy if exists "用户可更新自己的收藏" on public.collections;
create policy "用户可更新自己的收藏"
  on public.collections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 完成！之后前端就能通过 anon key 安全地读写收藏了。
-- ============================================================
