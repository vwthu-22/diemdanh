'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    router.push(token ? '/admin/dashboard' : '/admin/login');
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
      <div className="spinner" />
      <span style={{ color: 'var(--color-text-muted)' }}>Đang chuyển hướng...</span>
    </div>
  );
}
