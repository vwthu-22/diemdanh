'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import styles from './login.module.css';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCallback,
        ux_mode: 'popup',
      });
      setGoogleReady(true);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleGoogleCallback = async (response: { credential: string }) => {
    setGoogleLoading(true);
    setError('');
    try {
      const r = await api.post('/auth/google', { id_token: response.credential });
      localStorage.setItem('admin_token', r.data.access_token);
      if (r.data.name) localStorage.setItem('admin_name', r.data.name);
      if (r.data.picture) localStorage.setItem('admin_picture', r.data.picture);
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Đăng nhập Google thất bại!');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleClick = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.post('/auth/login', form);
      localStorage.setItem('admin_token', r.data.access_token);
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Đăng nhập thất bại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={`card ${styles.loginCard} fade-in`}>
        <div className={styles.logoWrap}>
          <span className={styles.logoIcon}>🎓</span>
        </div>
        <h1 className={styles.title}>Đăng nhập Giáo viên</h1>
        <p className={styles.subtitle}>Hệ thống Điểm danh CQP 22</p>

        {/* Google Login */}
        {clientId && (
          <>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={handleGoogleClick}
              disabled={!googleReady || googleLoading}
              id="google-login-btn"
            >
              {googleLoading ? (
                <><div className="spinner" /> Đang xác thực...</>
              ) : (
                <>
                  <svg className={styles.googleIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Đăng nhập bằng Google
                </>
              )}
            </button>

            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>hoặc</span>
              <span className={styles.dividerLine} />
            </div>
          </>
        )}

        {/* Username/Password form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Tên đăng nhập</label>
            <input
              className="input"
              type="text"
              placeholder="Tài khoản"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              id="admin-username"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Mật khẩu</label>
            <input
              className="input"
              type="password"
              placeholder="Mật khẩu"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              id="admin-password"
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={`btn btn-primary btn-lg w-full`} disabled={loading} id="admin-login-btn">
            {loading ? <><div className="spinner" /> Đang đăng nhập...</> : 'Đăng nhập'}
          </button>
        </form>

        <a href="/" className={styles.backLink}>Về trang điểm danh sinh viên</a>
      </div>
    </div>
  );
}
