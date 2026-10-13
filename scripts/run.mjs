import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const [tool, ...args] = process.argv.slice(2)

if (!tool || !['next', 'prisma'].includes(tool)) {
  throw new Error('Uso: node scripts/run.mjs <next|prisma> [argumentos]')
}

loadEnvConfig(appRoot, tool === 'next' && args[0] === 'dev' ? 'development' : 'production')

const childEnv = { ...process.env }
if (tool === 'next') {
  childEnv.NODE_ENV = args[0] === 'dev' ? 'development' : 'production'
}

const candidates = tool === 'next'
  ? [resolve(appRoot, 'node_modules/next/dist/bin/next')]
  : [resolve(appRoot, 'node_modules/prisma/build/index.js')]
const bin = candidates.find(existsSync)

if (!bin) throw new Error(`Dependência ${tool} ausente. Execute npm install na pasta atendimento-clinico.`)

const child = spawn(process.execPath, [bin, ...args], {
  cwd: appRoot,
  env: childEnv,
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', error => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1
})
