/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@dqbd/tiktoken"]
  },
  async redirects() {
    return [
      {
        source: '/benchmark',
        destination: '/benchmarks',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
