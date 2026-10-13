import { NextRequest, NextResponse } from 'next/server'
import { getClinicalActor } from '@/lib/auth'
import { brazilDateKey } from '@/lib/clinicalPatientEligibility'
import { getVisitEligiblePatients } from '@/lib/patientQueries'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const actor = await getClinicalActor(request)
  if (!actor) return NextResponse.json({ sucesso: false, mensagem: 'Sessão expirada' }, { status: 401 })
  try {
    const date = request.nextUrl.searchParams.get('data') || brazilDateKey(new Date())!
    const patients = await getVisitEligiblePatients(date, '', 500)
    const scaleIds = Array.from(new Set(patients.map(patient => Number(patient.escala_id)).filter(id => Number.isInteger(id) && id > 0)))
    const assignmentRows = scaleIds.length ? await prisma.$queryRaw<Array<{ Pedido: number; CodInd: number | null }>>(Prisma.sql`
      SELECT Pedido, CodInd FROM Servico WHERE Pedido IN (${Prisma.join(scaleIds)} ) AND COALESCE(CodInd,0)>0
      UNION
      SELECT Pedido, CodInd2 AS CodInd FROM Servico WHERE Pedido IN (${Prisma.join(scaleIds)} ) AND COALESCE(CodInd2,0)>0
      UNION
      SELECT Pedido, CodInd3 AS CodInd FROM Servico WHERE Pedido IN (${Prisma.join(scaleIds)} ) AND COALESCE(CodInd3,0)>0
      UNION
      SELECT Pedido, CodInd FROM Servico1 WHERE Pedido IN (${Prisma.join(scaleIds)} ) AND COALESCE(CodInd,0)>0 AND (Deletar IS NULL OR Deletar<>N'S')
      UNION
      SELECT Pedido, CodInd2 AS CodInd FROM Servico1 WHERE Pedido IN (${Prisma.join(scaleIds)} ) AND COALESCE(CodInd2,0)>0 AND (Deletar IS NULL OR Deletar<>N'S')
      UNION
      SELECT Pedido, CodInd3 AS CodInd FROM Servico1 WHERE Pedido IN (${Prisma.join(scaleIds)} ) AND COALESCE(CodInd3,0)>0 AND (Deletar IS NULL OR Deletar<>N'S')
    `) : []
    const staffIds = Array.from(new Set(assignmentRows.map(row => Number(row.CodInd)).filter(id => Number.isInteger(id) && id > 0)))
    const staffRows = staffIds.length ? await prisma.$queryRaw<Array<{ id: number; nome: string | null }>>(Prisma.sql`
      SELECT CodCli AS id, COALESCE(NULLIF(LTRIM(RTRIM(Cliente)),''),Razao) AS nome FROM CLIENTEs WHERE CodCli IN (${Prisma.join(staffIds)})
      UNION
      SELECT CodUsu AS id, Usuario AS nome FROM Senha WHERE CodUsu IN (${Prisma.join(staffIds)})
    `) : []
    const nameById = new Map(staffRows.map(row => [Number(row.id), row.nome || `Profissional ${row.id}`]))
    const staffByScale = new Map<number, Array<{ id: number; nome: string }>>()
    assignmentRows.forEach(row => {
      const id = Number(row.CodInd)
      if (!Number.isInteger(id) || id < 1) return
      const assigned = staffByScale.get(Number(row.Pedido)) || []
      if (!assigned.some(item => item.id === id)) assigned.push({ id, nome: nameById.get(id) || `Profissional ${id}` })
      staffByScale.set(Number(row.Pedido), assigned)
    })
    const data = patients.map(patient => ({
      id: Number(patient.escala_id), codCli: Number(patient.id), idoso: patient.nome || patient.razao || `Idoso #${patient.id}`,
      contratante: patient.escala_contratante || patient.responsavel_nome || 'Não informado',
      cliente: patient.nome || patient.razao || `Idoso #${patient.id}`, status: 'ATIVO',
      dataInicio: patient.escala_inicio ? new Date(patient.escala_inicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null,
      dataFim: patient.escala_fim ? new Date(patient.escala_fim).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null,
      responsavel: patient.escala_responsavel || null, cuidadores: staffByScale.get(Number(patient.escala_id)) || [],
    }))
    return NextResponse.json({ sucesso: true, data }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Falha ao carregar escalas clínicas', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar as escalas ativas.' }, { status: 500 })
  }
}
