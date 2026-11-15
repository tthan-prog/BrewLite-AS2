import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gói server tối giản để chạy trong Docker (ADR 007).
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
