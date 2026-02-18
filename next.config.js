/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@dqbd/tiktoken"]
  },
  async redirects() {
    return [
      {
        source: '/benchmark/:path*',
        destination: '/benchmarks/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
