import { PrismaClient } from '@/generated/client'

const globalForPrisma = globalThis as unknown as { clinicalPrisma?: PrismaClient }

export const prisma = globalForPrisma.clinicalPrisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.clinicalPrisma = prisma
