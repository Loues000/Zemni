/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@dqbd/tiktoken"]
  }
};

module.exports = nextConfig;
