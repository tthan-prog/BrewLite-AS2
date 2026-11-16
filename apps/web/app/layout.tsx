import { SiteHeader } from "../components/site-header";
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'BrewLite Coffee House', template: '%s · BrewLite' },
  description: 'Đặt và thanh toán đồ uống không tiền mặt',
  appleWebApp: { capable: true, title: 'BrewLite', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#30271F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body><SiteHeader />{children}</body>
    </html>
  );
}
