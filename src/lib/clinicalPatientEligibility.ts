import { prisma } from '@/lib/prisma'

export function brazilDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** A patient is schedulable only when the scale covers the actual appointment date and has a staffed active shift. */
export async function hasScaleForPatientOnDate(codCli: number, visitDate: Date | string) {
  const dateKey = brazilDateKey(visitDate)
  if (!Number.isInteger(codCli) || codCli < 1 || !dateKey) return false
  const eligible = await prisma.$queryRaw<Array<{ Pedido: number }>>`
    SELECT TOP 1 sv.Pedido
    FROM CLIENTEs c
    JOIN Servico sv ON sv.Codcli = c.CodCli OR sv.Codcli = c.CodCli1
    WHERE c.CodCli = ${codCli}
      AND sv.DataInicio IS NOT NULL
      AND CAST(sv.DataInicio AS date) <= CAST(${dateKey} AS date)
      AND (sv.Status IS NULL OR LTRIM(RTRIM(sv.Status)) IN (N'', N'ATIVO', N'ATIVA'))
      AND (
        sv.DataSaida IS NULL OR CAST(sv.DataSaida AS date) >= CAST(${dateKey} AS date)
        OR (sv.DataSaida < sv.DataInicio AND CAST(${dateKey} AS date) <= (
          SELECT MAX(CAST(shEnd.Data AS date)) FROM Servico1 shEnd
          WHERE shEnd.Pedido = sv.Pedido AND (shEnd.Deletar IS NULL OR shEnd.Deletar <> N'S')
        ))
      )
      AND (
        COALESCE(sv.CodInd, 0) > 0 OR COALESCE(sv.CodInd2, 0) > 0 OR COALESCE(sv.CodInd3, 0) > 0
        OR EXISTS (
          SELECT 1 FROM Servico1 sh
          WHERE sh.Pedido = sv.Pedido AND (sh.Deletar IS NULL OR sh.Deletar <> N'S')
            AND CAST(sh.Data AS date) <= CAST(${dateKey} AS date)
            AND (COALESCE(sh.CodInd, 0) > 0 OR COALESCE(sh.CodInd2, 0) > 0 OR COALESCE(sh.CodInd3, 0) > 0)
        )
      )
    ORDER BY sv.DataInicio DESC, sv.Pedido DESC
  `
  return eligible.length > 0
}
