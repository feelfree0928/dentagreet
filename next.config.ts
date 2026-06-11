import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow other machines on the LAN to load dev-only assets (/_next/*, HMR).
  // Next blocks cross-origin dev requests by default; list the IPs/hosts you
  // open the app from. Use the exact host shown in the browser's URL bar.
  allowedDevOrigins: ['192.168.109.126', '198.18.3.41'],
  // Allow camera/microphone for Daily.co WebRTC
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*, display-capture=*',
          },
        ],
      },
    ];
  },
  // Turbopack config (Next.js 16+ default bundler)
  // daily-js is browser-only; it self-detects the environment at runtime.
  // No special bundler config needed — it works fine with Turbopack.
  turbopack: {},
};

export default nextConfig;
