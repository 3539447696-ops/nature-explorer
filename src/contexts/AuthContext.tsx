import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signUpEmail: (email: string, password: string) => Promise<{ error?: string; needConfirm?: boolean }>;
  signInEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInOAuth: (provider: 'google' | 'github') => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    // 初始化：读取已有会话
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    // 订阅登录状态变化（登录/登出/token 刷新）
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: '云端未配置' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    // 若开启了邮箱确认，session 为空，需要用户去邮箱点确认
    const needConfirm = !data.session;
    return { needConfirm };
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: '云端未配置' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    return {};
  }, []);

  const signInOAuth = useCallback(async (provider: 'google' | 'github') => {
    if (!supabase) return { error: '云端未配置' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) return { error: translateAuthError(error.message) };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    configured: SUPABASE_CONFIGURED,
    signUpEmail,
    signInEmail,
    signInOAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}

// 把常见的英文错误翻译成中文提示
function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return '邮箱或密码不正确';
  if (m.includes('user already registered')) return '该邮箱已注册，请直接登录';
  if (m.includes('password should be at least')) return '密码太短（至少 6 位）';
  if (m.includes('unable to validate email')) return '邮箱格式不正确';
  if (m.includes('email not confirmed')) return '邮箱尚未验证，请查收确认邮件';
  if (m.includes('provider is not enabled')) return '该第三方登录未在 Supabase 中启用';
  return msg;
}
