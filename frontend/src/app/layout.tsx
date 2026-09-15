import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Điểm danh CQP22 - Trường Cao đẳng Truyền hình',
  description: 'Hệ thống điểm danh lớp CQP22 - Quay phim - Trường Cao đẳng Truyền hình Việt Nam',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
