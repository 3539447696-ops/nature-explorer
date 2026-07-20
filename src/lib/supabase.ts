import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 客户端。
 * 配置来自环境变量（.env.local）。若未配置，supabase 为 null，
 * 应用会自动退回“纯本地模式”（图鉴存 localStorage，无账号功能），
 * 保证在没有后端的情况下仍可完整体验。
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIGURED =
  !!url &&
  !!anonKey &&
  !url.includes('YOUR-PROJECT-ID') &&
  !anonKey.includes('YOUR-ANON');

export const supabase: SupabaseClient | null = SUPABASE_CONFIGURED
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (SUPABASE_CONFIGURED) {
  console.log('[Supabase] 已连接云端');
} else {
  console.warn('[Supabase] 未配置，运行在纯本地模式（图鉴仅存本机，无账号功能）');
}
