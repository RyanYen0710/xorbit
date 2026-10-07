import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@orbit/ui', '@orbit/themes', '@orbit/types'],
  poweredByHeader: false,
}
export default config
