import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasScaleForPatientOnDate } from '@/lib/clinicalPatientEligibility'
import { requireClinicalAccess } from '@/lib/profileAccess'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function validatePatient(id: number) {
  if (!Number.isInteger(id) || id < 1) return false
  const patient = await prisma.$queryRaw<Array<{ CodCli: number }>>`SELECT TOP 1 CodCli FROM CLIENTEs WHERE CodCli = ${id}`
  return Boolean(patient.length && await hasScaleForPatientOnDate(id, new Date()))
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const codCli = Number(params.id)
    if (!await validatePatient(codCli)) return NextResponse.json({ sucesso: false, mensagem: 'Paciente sem escala ativa para atendimento clínico' }, { status: 404 })
    const rows = await prisma.$queryRaw<any[]>`
      SELECT TOP 10 p.PlanoId, p.CodCli, p.Objetivos, p.Cuidados, p.Riscos, p.Contatos, p.RevisarEm, p.CriadoEm,
        s.Usuario AS Enfermeira
      FROM AtendimentoClinicoPlanoCuidado p
      LEFT JOIN Senha s ON s.CodUsu = p.EnfermeiraCodUsu
      WHERE p.CodCli = ${codCli}
      ORDER BY p.CriadoEm DESC, p.PlanoId DESC
    `
    await prisma.$executeRaw`
      INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, CodCli)
      VALUES (${Number(request.headers.get('x-user-id'))}, N'PLANO_CONSULTADO', N'PLANO_CUIDADO', ${codCli})
    `
    return NextResponse.json({ sucesso: true, plano: rows[0] || null, versoes: rows })
  } catch (error) {
    console.error('Falha ao carregar plano de cuidado', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar o plano de cuidado' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const codCli = Number(params.id)
    const codUsu = Number(request.headers.get('x-user-id'))
    if (!Number.isInteger(codUsu) || codUsu < 1 || !await validatePatient(codCli)) {
      return NextResponse.json({ sucesso: false, mensagem: 'Paciente sem escala ativa ou profissional inválido' }, { status: 400 })
    }
    const body = await request.json()
    const field = (key: string, max: number) => String(body[key] ?? '').trim().slice(0, max) || null
    const reviewDate = body.revisarEm ? new Date(`${String(body.revisarEm).slice(0, 10)}T12:00:00`) : null
    if (body.revisarEm && (!reviewDate || !Number.isFinite(reviewDate.getTime()))) {
      return NextResponse.json({ sucesso: false, mensagem: 'Data de revisão inválida' }, { status: 400 })
    }
    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO AtendimentoClinicoPlanoCuidado
        (CodCli, EnfermeiraCodUsu, Objetivos, Cuidados, Riscos, Contatos, RevisarEm)
      OUTPUT INSERTED.PlanoId, INSERTED.CodCli, INSERTED.Objetivos, INSERTED.Cuidados,
        INSERTED.Riscos, INSERTED.Contatos, INSERTED.RevisarEm, INSERTED.CriadoEm
      VALUES (${codCli}, ${codUsu}, ${field('objetivos', 8000)}, ${field('cuidados', 12000)},
        ${field('riscos', 8000)}, ${field('contatos', 4000)}, ${reviewDate})
    `
    const plano = rows[0]
    await prisma.$executeRaw`
      INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli, Detalhes)
      VALUES (${codUsu}, N'PLANO_CRIADO', N'PLANO_CUIDADO', ${String(plano.PlanoId)}, ${codCli}, N'Nova versão do plano de cuidado')
    `
    return NextResponse.json({ sucesso: true, plano }, { status: 201 })
  } catch (error) {
    console.error('Falha ao salvar plano de cuidado', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível salvar o plano de cuidado' }, { status: 500 })
  }
}
