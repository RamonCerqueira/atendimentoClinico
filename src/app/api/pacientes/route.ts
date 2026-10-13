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
    const params = request.nextUrl.searchParams
    const requestedDate = params.get('data') || brazilDateKey(new Date())!
    const data = await getVisitEligiblePatients(requestedDate, params.get('busca') || '', Number(params.get('limit') || 8), params.get('bairro') || '', params.get('bairroExato') === '1')
    const scaleIds = Array.from(new Set(data.map(row => Number(row.escala_id)).filter(id => Number.isInteger(id) && id > 0)))
    const assignments = scaleIds.length ? await prisma.$queryRaw<Array<{ Pedido: number; CodInd: number | null }>>(Prisma.sql`
      SELECT Pedido, CodInd FROM Servico WHERE Pedido IN (${Prisma.join(scaleIds)}) AND COALESCE(CodInd, 0) > 0
      UNION
      SELECT Pedido, CodInd2 AS CodInd FROM Servico WHERE Pedido IN (${Prisma.join(scaleIds)}) AND COALESCE(CodInd2, 0) > 0
      UNION
      SELECT Pedido, CodInd3 AS CodInd FROM Servico WHERE Pedido IN (${Prisma.join(scaleIds)}) AND COALESCE(CodInd3, 0) > 0
      UNION
      SELECT Pedido, CodInd FROM Servico1 WHERE Pedido IN (${Prisma.join(scaleIds)}) AND COALESCE(CodInd, 0) > 0 AND (Deletar IS NULL OR Deletar <> N'S')
      UNION
      SELECT Pedido, CodInd2 AS CodInd FROM Servico1 WHERE Pedido IN (${Prisma.join(scaleIds)}) AND COALESCE(CodInd2, 0) > 0 AND (Deletar IS NULL OR Deletar <> N'S')
      UNION
      SELECT Pedido, CodInd3 AS CodInd FROM Servico1 WHERE Pedido IN (${Prisma.join(scaleIds)}) AND COALESCE(CodInd3, 0) > 0 AND (Deletar IS NULL OR Deletar <> N'S')
    `) : []
    const staffIds = Array.from(new Set(assignments.map(row => Number(row.CodInd)).filter(id => Number.isInteger(id) && id > 0)))
    const staff = staffIds.length ? await prisma.$queryRaw<Array<{ id: number; nome: string | null }>>(Prisma.sql`
      SELECT CodCli AS id, COALESCE(NULLIF(LTRIM(RTRIM(Cliente)), ''), Razao) AS nome FROM CLIENTEs WHERE CodCli IN (${Prisma.join(staffIds)})
      UNION
      SELECT CodUsu AS id, Usuario AS nome FROM Senha WHERE CodUsu IN (${Prisma.join(staffIds)})
    `) : []
    const namesById = new Map(staff.map(row => [Number(row.id), row.nome || `Profissional ${row.id}`]))
    const teamByScale = new Map<number, Array<{ id: number; nome: string }>>()
    assignments.forEach(row => {
      const id = Number(row.CodInd)
      if (!Number.isInteger(id) || id < 1) return
      const team = teamByScale.get(Number(row.Pedido)) || []
      if (!team.some(member => member.id === id)) team.push({ id, nome: namesById.get(id) || `Profissional ${id}` })
      teamByScale.set(Number(row.Pedido), team)
    })
    const pacientes = data.map(row => ({
      id: Number(row.id), responsavel_id: row.responsavel_id == null ? undefined : Number(row.responsavel_id),
      nome: row.nome, razao: row.razao, cpf_cnpj: row.cpf_cnpj,
      data_nascimento: row.data_nascimento ? new Date(row.data_nascimento).toISOString().slice(0, 10) : null,
      sexo: row.sexo, telefone: row.telefone, celular: row.celular, email: row.email,
      endereco: row.endereco, complemento: row.complemento, numero: row.numero,
      bairro: row.bairro, cidade: row.cidade, estado: row.estado, cep: row.cep,
      segmento: row.segmento, cod_segmento: row.cod_segmento, status: 'ATIVO', responsavel_nome: row.responsavel_nome,
      escala_id: row.escala_id == null ? null : Number(row.escala_id),
      escala_inicio: row.escala_inicio, escala_fim: row.escala_fim,
      escala_responsavel: row.escala_responsavel, escala_contratante: row.escala_contratante,
      escala_cuidadores: row.escala_id == null ? [] : teamByScale.get(Number(row.escala_id)) || [],
    }))
    return NextResponse.json({ sucesso: true, data: pacientes, clientes: pacientes }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Falha ao carregar idosos elegíveis', error)
    return NextResponse.json({ sucesso: false, mensagem: error instanceof Error ? error.message : 'Não foi possível carregar idosos com escala elegível.' }, { status: 500 })
  }
}
