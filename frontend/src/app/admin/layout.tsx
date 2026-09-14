'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token && pathname !== '/admin/login' && pathname !== '/admin') {
      router.push('/admin/login');
    }
  }, [pathname, router]);

  const isLoginPage = pathname === '/admin/login' || pathname === '/admin';

  const logout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  if (isLoginPage) return <>{children}</>;

  const navItems = [
    { href: '/admin/dashboard', label: '📊 Dashboard', id: 'nav-dashboard' },
    { href: '/schedule', label: '📅 Thời khóa biểu', id: 'nav-schedule' },
    { href: '/admin/export', label: '📥 Xuất file', id: 'nav-export' },
    { href: '/admin/settings', label: '⚙️ Cài đặt', id: 'nav-settings' },
  ];

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.sidebarLogo}>
            <div className={styles.sidebarLogoIcon}>📹</div>
            <div>
              <div className={styles.sidebarTitle}>CQP 22</div>
              <div className={styles.sidebarSub}>Quản lý</div>
            </div>
          </div>

          <nav className={styles.nav}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                id={item.id}
                className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <Link href="/" className={styles.navItem} id="nav-student-view">
            👤 Trang sinh viên
          </Link>
          <button onClick={logout} className={styles.logoutBtn} id="nav-logout">
            🚪 Đăng xuất
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className={styles.mobileHeader}>
        <div className={styles.mobileHeaderInner}>
          <span className={styles.mobileLogo}>📹 CQP 22</span>
          <div className={styles.mobileNav}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.mobileNavItem} ${pathname === item.href ? styles.mobileNavItemActive : ''}`}
              >
                {item.label.split(' ')[0]}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={styles.content}>{children}</main>
    </div>
  );
}
