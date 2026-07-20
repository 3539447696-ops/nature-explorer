-- ============================================================
-- 自然探索家 · 社区分享功能 · 数据库脚本
-- 使用方法：Supabase 项目 → SQL Editor → New query → 粘贴运行
-- ============================================================

-- 1) 分享帖子表
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  user_email   text,                       -- 冗余存储，方便展示作者
  species_id   text,                        -- 关联的物种（inat-<id> 或 fb-<id>），可空
  species_cn   text,                        -- 物种中文名（冗余，方便展示）
  species_sci  text,                        -- 物种学名
  taxon        text,                        -- 大类（Aves/Plantae/...）
  photo_url    text not null,               -- 照片地址（Supabase Storage 公开链接）
  caption      text,                        -- 用户描述
  location     text,                        -- 拍摄地点
  lat          double precision,            -- 纬度（可空）
  lng          double precision,            -- 经度（可空）
  created_at   timestamptz not null default now()
);

-- 加速查询：按物种、按时间
create index if not exists posts_species_idx on public.posts(species_id);
create index if not exists posts_created_idx on public.posts(created_at desc);

-- 2) 开启行级安全
alter table public.posts enable row level security;

-- 3) 安全策略
-- 所有人都能查看分享（公开社区）
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts for select using (true);

-- 只有登录用户能发布，且只能以自己身份发
drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);

-- 只能删自己的分享
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts for delete using (auth.uid() = user_id);

-- ============================================================
-- 4) 图片存储桶（Storage）
-- ⚠️ 下面用 SQL 创建 bucket；如果报错，也可以在 Supabase 后台手动建：
--    Storage → New bucket → 名字填 post-photos → 勾选 Public bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do nothing;

-- Storage 安全策略：所有人可读，登录用户可上传
drop policy if exists "photos_public_read" on storage.objects;
create policy "photos_public_read" on storage.objects
  for select using (bucket_id = 'post-photos');

drop policy if exists "photos_auth_upload" on storage.objects;
create policy "photos_auth_upload" on storage.objects
  for insert with check (bucket_id = 'post-photos' and auth.role() = 'authenticated');

drop policy if exists "photos_owner_delete" on storage.objects;
create policy "photos_owner_delete" on storage.objects
  for delete using (bucket_id = 'post-photos' and auth.uid() = owner);

-- ============================================================
-- 完成！之后用户就能上传照片、发布分享，并在社区和物种卡片看到了。
-- ============================================================
