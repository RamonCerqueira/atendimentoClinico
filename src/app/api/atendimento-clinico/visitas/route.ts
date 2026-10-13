import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess, requireClinicalAccess } from '@/lib/profileAccess'
import { hasScaleForPatientOnDate } from '@/lib/clinicalPatientEligibility'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied

  try {
    await ensureAtendimentoClinicoTables()
    const userId = Number(request.headers.get('x-user-id'))
    const isAdmin = hasPrivilegedAccess(request)
    const start = request.nextUrl.searchParams.get('inicio') || new Date().toISOString().slice(0, 10)
    const end = request.nextUrl.searchParams.get('fim') || start
    const rows = await prisma.$queryRaw<any[]>`
      SELECT v.VisitaId, v.CodCli, COALESCE(c.Cliente, c.Razao) AS NomePaciente,
        c.Endereco, c.Bairro, c.Cidade, v.EnfermeiraCodUsu, s.Usuario AS Enfermeira, v.DataHora, v.Status,
        v.IniciadoEm, v.FinalizadoEm
      FROM AtendimentoClinicoVisita v
      LEFT JOIN CLIENTEs c ON c.CodCli = v.CodCli
      LEFT JOIN Senha s ON s.CodUsu = v.EnfermeiraCodUsu
      WHERE v.DataHora >= CAST(${start} AS date)
        AND v.DataHora < DATEADD(day, 1, CAST(${end} AS date))
        AND (${isAdmin ? 1 : 0} = 1 OR v.EnfermeiraCodUsu = ${userId})
      ORDER BY v.DataHora ASC
    `
    const enfermeiras = await prisma.$queryRaw<Array<{ CodUsu: number; Usuario: string | null }>>`
      SELECT CodUsu, Usuario FROM Senha
      WHERE LTRIM(RTRIM(ISNULL(Perfil, ''))) = '6' AND AtendimentoClinico = 1
      ORDER BY Usuario
    `
    return NextResponse.json({ sucesso: true, visitas: rows, enfermeiras: enfermeiras.map(user => ({ id: user.CodUsu, nome: user.Usuario || `Usuário ${user.CodUsu}` })) })
  } catch (error) {
    console.error('Falha ao listar visitas clínicas', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar a agenda clínica' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied

  try {
    await ensureAtendimentoClinicoTables()
    const body = await request.json()
    const codCli = Number(body.codCli)
    const userId = Number(request.headers.get('x-user-id'))
    let enfermeiraCodUsu = userId
    if (hasPrivilegedAccess(request)) {
      enfermeiraCodUsu = Number(body.enfermeiraCodUsu)
      if (!Number.isInteger(enfermeiraCodUsu) || enfermeiraCodUsu < 1) {
        return NextResponse.json({ sucesso: false, mensagem: 'Selecione uma enfermeira habilitada para a visita' }, { status: 400 })
      }
      const permittedNurse = await prisma.$queryRaw<any[]>`
        SELECT TOP 1 CodUsu FROM Senha
        WHERE CodUsu = ${enfermeiraCodUsu} AND LTRIM(RTRIM(ISNULL(Perfil, ''))) = '6' AND AtendimentoClinico = 1
      `
      if (!permittedNurse.length) return NextResponse.json({ sucesso: false, mensagem: 'A profissional selecionada não está habilitada para visitas' }, { status: 400 })
    }
    const dataHora = new Date(body.dataHora)
    if (!Number.isInteger(codCli) || !Number.isInteger(enfermeiraCodUsu) || !Number.isFinite(dataHora.getTime())) {
      return NextResponse.json({ sucesso: false, mensagem: 'Paciente e data da visita são obrigatórios' }, { status: 400 })
    }
    if (dataHora.getTime() <= Date.now()) return NextResponse.json({ sucesso: false, mensagem: 'Escolha um horário futuro para a visita' }, { status: 400 })
    const patient = await prisma.$queryRaw<Array<{ CodCli: number }>>`SELECT TOP 1 CodCli FROM CLIENTEs WHERE CodCli = ${codCli}`
    if (!patient.length) return NextResponse.json({ sucesso: false, mensagem: 'Paciente não encontrado' }, { status: 404 })
    if (!await hasScaleForPatientOnDate(codCli, dataHora)) {
      return NextResponse.json({ sucesso: false, mensagem: 'O idoso precisa ter escala ativa e equipe atribuída na data da visita' }, { status: 400 })
    }
    const created = await prisma.$transaction(async transaction => {
      const conflicts = await transaction.$queryRaw<Array<{ VisitaId: number }>>`
        SELECT TOP 1 VisitaId FROM AtendimentoClinicoVisita WITH (UPDLOCK, HOLDLOCK)
        WHERE EnfermeiraCodUsu = ${enfermeiraCodUsu}
          AND Status IN (N'PENDENTE', N'CONFIRMADA', N'EM_ATENDIMENTO')
          AND DataHora > DATEADD(second, -5400, ${dataHora}) AND DataHora < DATEADD(second, 5400, ${dataHora})
      `
      if (conflicts.length) return { conflict: true as const, visit: null }
      const inserted = await transaction.$queryRaw<any[]>`
        INSERT INTO AtendimentoClinicoVisita (CodCli, EnfermeiraCodUsu, DataHora)
        OUTPUT INSERTED.VisitaId, INSERTED.CodCli, INSERTED.DataHora, INSERTED.Status
        VALUES (${codCli}, ${enfermeiraCodUsu}, ${dataHora})
      `
      await transaction.$executeRaw`
        INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli)
        VALUES (${userId}, N'VISITA_AGENDADA', N'VISITA', ${String(inserted[0].VisitaId)}, ${codCli})
      `
      return { conflict: false as const, visit: inserted[0] }
    }, { isolationLevel: 'Serializable' })
    if (created.conflict) return NextResponse.json({ sucesso: false, mensagem: 'A enfermeira já tem uma visita dentro do intervalo de 90 minutos.' }, { status: 409 })
    return NextResponse.json({ sucesso: true, visita: created.visit }, { status: 201 })
  } catch (error) {
    console.error('Falha ao criar visita clínica', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível agendar a visita' }, { status: 500 })
  }
}
