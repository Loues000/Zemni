/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@dqbd/tiktoken"],
    instrumentationHook: true,
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /node_modules\/@opentelemetry\/instrumentation/ },
      { module: /node_modules\/@prisma\/instrumentation/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },
  // Disable static optimization for pages that use Clerk
  // This allows the build to complete even with placeholder keys
  output: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("YOUR_CLERK")
    ? undefined
    : undefined,
};

module.exports = nextConfig;
