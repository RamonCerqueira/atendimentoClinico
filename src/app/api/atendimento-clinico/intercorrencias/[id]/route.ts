import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess, requireClinicalAccess } from '@/lib/profileAccess'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const id = Number(params.id)
    const userId = Number(request.headers.get('x-user-id'))
    const body = await request.json()
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ sucesso: false, mensagem: 'Registro inválido.' }, { status: 400 })
    const current = await prisma.$queryRaw<Array<{ IntercorrenciaId: number; CodCli: number; EnfermeiraCodUsu: number; Status: string }>>`
      SELECT TOP 1 IntercorrenciaId, CodCli, EnfermeiraCodUsu, Status FROM AtendimentoClinicoIntercorrencia WHERE IntercorrenciaId=${id}
    `
    if (!current.length) return NextResponse.json({ sucesso: false, mensagem: 'Intercorrência não encontrada.' }, { status: 404 })
    if (!hasPrivilegedAccess(request) && Number(current[0].EnfermeiraCodUsu) !== userId) return NextResponse.json({ sucesso: false, mensagem: 'Só é possível atualizar suas próprias intercorrências.' }, { status: 403 })
    const allowed = ['ABERTA', 'EM_ACOMPANHAMENTO', 'RESOLVIDA']
    const status = String(body.status || current[0].Status).toUpperCase()
    if (!allowed.includes(status)) return NextResponse.json({ sucesso: false, mensagem: 'Status inválido.' }, { status: 400 })
    const conduta = body.conduta === undefined ? null : String(body.conduta || '').trim().slice(0, 10000) || null
    await prisma.$executeRaw`
      UPDATE AtendimentoClinicoIntercorrencia
      SET Status=${status},
          Conduta=COALESCE(${conduta}, Conduta),
          ResolvidaEm=CASE WHEN ${status}=N'RESOLVIDA' THEN COALESCE(ResolvidaEm,SYSUTCDATETIME()) ELSE NULL END,
          ResolvidaPor=CASE WHEN ${status}=N'RESOLVIDA' THEN ${userId} ELSE NULL END
      WHERE IntercorrenciaId=${id}
    `
    await prisma.$executeRaw`INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli) VALUES (${userId}, ${status === 'RESOLVIDA' ? 'INTERCORRENCIA_RESOLVIDA' : 'INTERCORRENCIA_ATUALIZADA'}, N'INTERCORRENCIA', ${String(id)}, ${Number(current[0].CodCli)})`
    return NextResponse.json({ sucesso: true })
  } catch {
    console.error('Falha ao atualizar intercorrência clínica')
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível atualizar a intercorrência.' }, { status: 500 })
  }
}
