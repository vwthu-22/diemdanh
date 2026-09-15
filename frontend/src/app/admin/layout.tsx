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
    { href: '/admin/dashboard', label: 'Dashboard', id: 'nav-dashboard' },
    { href: '/admin/export', label: 'Xuất file', id: 'nav-export' },
    { href: '/admin/settings', label: 'Cài đặt', id: 'nav-settings' },
  ];

  return (
    <div className={styles.layout}>
      {/* ── Desktop Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.sidebarLogo}>
            <div>
              <div className={styles.sidebarTitle}>CQP 22</div>
              <div className={styles.sidebarSub}>Quản lý điểm danh</div>
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
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <Link href="/" className={styles.navItem} id="nav-student-view">
            <span>Trang sinh viên</span>
          </Link>
          <button onClick={logout} className={styles.logoutBtn} id="nav-logout">
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Header ── */}
      <header className={styles.mobileHeader}>
        <div className={styles.mobileHeaderInner}>
          <span className={styles.mobileLogo}>CQP 22</span>
          <div className={styles.mobileHeaderActions}>
            <Link href="/" className={styles.mobileHeaderLink} title="Trang sinh viên">
              Trang sinh viên
            </Link>
            <button onClick={logout} className={styles.mobileLogoutBtn} title="Đăng xuất">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className={styles.content}>{children}</main>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav className={styles.bottomNav}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              id={`mobile-${item.id}`}
              className={`${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`}
            >
              <span className={styles.bottomNavLabel}>{item.label}</span>
              {isActive && <span className={styles.bottomNavIndicator} />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
