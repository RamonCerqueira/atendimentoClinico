import { NextRequest, NextResponse } from 'next/server'
import { getClinicalActor } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getClinicalActor(request)
  if (!actor) return NextResponse.json({ sucesso: false, mensagem: 'Sessão expirada' }, { status: 401 })
  const codCli = Number(params.id)
  if (!Number.isInteger(codCli) || codCli < 1) return NextResponse.json({ sucesso: false, mensagem: 'Idoso inválido' }, { status: 400 })
  try {
    const records = await prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT TOP 1 AnamneseId, CodCli, MotivoConsulta, Patologias, OutrosPatologias,
        HistoricoFamiliar, AtividadeFisica, AtividadeFisica_Frequencia, Tabagismo,
        Tabagismo_Frequencia, Etilismo, Etilismo_Frequencia, FuncionamentoIntestinal,
        Consistencia, Observacoes, DataCriacao, DataAlteracao
      FROM FichaAnamnese WHERE CodCli = ${codCli} ORDER BY DataAlteracao DESC, AnamneseId DESC
    `
    if (!records.length) return NextResponse.json({ sucesso: true, anamnese: null }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
    const row = records[0]
    const medicamentos = await prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT MedicamentoId, AnamneseId, Nome, Dose, Horarios, Motivo
      FROM FichaAnamnese_Medicamento WHERE AnamneseId = ${row.AnamneseId} ORDER BY MedicamentoId
    `
    return NextResponse.json({ sucesso: true, anamnese: { ...row, FichaAnamnese_Medicamento: medicamentos } }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Falha ao consultar anamnese clínica', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar a ficha clínica existente.' }, { status: 500 })
  }
}
