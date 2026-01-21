/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@dqbd/tiktoken"]
  },
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

module.exports = nextConfig;
