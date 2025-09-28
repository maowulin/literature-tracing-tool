/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  async rewrites() {
    return [];
  },
  async headers() {
    return [];
  },
  env: {
    PORT: '9527',
  },
};

export default nextConfig;
