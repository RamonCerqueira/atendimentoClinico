import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const homeFilesGlob = `${os.homedir().replaceAll('\\', '/')}/**/*`
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    outputFileTracingRoot: projectRoot,
    // Next 14.2 needs this pre-glob ignore for Prisma's dynamic dotenv path.
    outputFileTracingIgnores: [homeFilesGlob],
  },
}
export default nextConfig
