import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DentaGreet — AI Dental Reception',
  description: 'AI-powered reception system for dental clinics',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
