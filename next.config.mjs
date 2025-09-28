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
};

export default nextConfig;
