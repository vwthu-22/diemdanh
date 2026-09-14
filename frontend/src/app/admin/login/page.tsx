'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import styles from './login.module.css';

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        <div className={styles.icon}>🔐</div>
        <h1 className={styles.title}>Đăng nhập Giáo viên</h1>
        <p className={styles.subtitle}>Hệ thống Điểm danh CQP 22</p>

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

        <a href="/" className={styles.backLink}>← Về trang điểm danh sinh viên</a>
      </div>
    </div>
  );
}
