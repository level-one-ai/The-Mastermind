import type { NextConfig } from 'next';

const config: NextConfig = {
  // The local data folder lives one level up (../library) when running from the repo.
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
};

export default config;
