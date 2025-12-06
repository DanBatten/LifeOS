/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@lifeos/core',
    '@lifeos/database',
    '@lifeos/llm',
    '@lifeos/agents',
    '@lifeos/orchestrator',
  ],
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', 'openai'],
  },
};

module.exports = nextConfig;
