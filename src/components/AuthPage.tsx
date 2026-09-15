import React, { useState } from 'react';
import { Card, Input, Button, Title } from 'animal-island-ui';
import { useAuth } from '../contexts/AuthContext';

/**
 * 登录 / 注册页。使用 animal-island-ui 组件。
 * 支持：邮箱密码登录、邮箱注册、Google / GitHub 第三方 SSO。
 * onSkip：未配置 Supabase 或用户选择“先逛逛”时，进入本地体验模式。
 */
export function AuthPage({ onSkip }: { onSkip: () => void }) {
  const { signInEmail, signUpEmail, signInOAuth, configured } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    setError('');
    setMsg('');
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    setLoading(true);
    if (mode === 'login') {
      const { error } = await signInEmail(email, password);
      if (error) setError(error);
    } else {
      const { error, needConfirm } = await signUpEmail(email, password);
      if (error) setError(error);
      else if (needConfirm) setMsg('注册成功！请前往邮箱点击确认链接后再登录。');
      else setMsg('注册成功，正在进入…');
    }
    setLoading(false);
  };

  const oauth = async (provider: 'google' | 'github') => {
    setError('');
    const { error } = await signInOAuth(provider);
    if (error) setError(error);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="big">🌿</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Title size="middle" color="app-green">自然探索家</Title>
        </div>

        <Card>
          <div className="auth-sub">
            {configured
              ? '不用注册也能直接探索附近的动植物；想让图鉴云端同步、换设备也能继续收集，再登录即可 🌏'
              : '当前为本地体验模式（未配置云端），图鉴仅保存在本机。'}
          </div>

          {configured && (
            // 首次访问者的核心路径：不强制注册就能先看到产品价值，登录留给"想要云同步"的人。
            // 放在表单最上方、做成醒目的主按钮，而不是页面最下面一行不起眼的小字链接。
            <Button type="primary" block size="large" onClick={onSkip} style={{ marginBottom: 14 }}>
              🌿 先逛逛，暂不登录
            </Button>
          )}

          {configured ? (
            <>
              <div className="auth-divider">或使用邮箱登录 / 注册</div>
              <div className="auth-field">
                <label>邮箱</label>
                <Input
                  value={email}
                  placeholder="you@example.com"
                  onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                />
              </div>
              <div className="auth-field">
                <label>密码</label>
                <Input
                  type="password"
                  value={password}
                  placeholder="至少 6 位"
                  onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                />
              </div>

              {error && <div className="auth-error">{error}</div>}
              {msg && <div className="auth-msg">{msg}</div>}

              <Button block size="large" loading={loading} onClick={submit}>
                {mode === 'login' ? '登录' : '注册'}
              </Button>

              <div className="auth-divider">或使用第三方账号</div>
              <div className="oauth-row">
                <Button block onClick={() => oauth('google')}>🔵 Google</Button>
                <Button block onClick={() => oauth('github')}>🐙 GitHub</Button>
              </div>

              <div className="auth-switch">
                {mode === 'login' ? '还没有账号？' : '已有账号？'}
                <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMsg(''); }}>
                  {mode === 'login' ? '去注册' : '去登录'}
                </button>
              </div>
            </>
          ) : (
            <Button type="primary" block size="large" onClick={onSkip}>
              开始探索（本地模式）
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
