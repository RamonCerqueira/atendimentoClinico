import { prisma } from '@/lib/prisma'
import { isValidDateKey } from '@/lib/clinicalPatientEligibility'

export async function getVisitEligiblePatients(dateKey: string, search = '', limit = 8, neighborhood = '', exactNeighborhood = false) {
  if (!isValidDateKey(dateKey)) throw new Error('A data de referência informada é inválida.')
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit) || 8))
  const query = search.trim().slice(0, 100)
  const neighborhoodQuery = neighborhood.trim().slice(0, 100)
  if (!query && !neighborhoodQuery) return []
  const like = `%${query.replace(/[\[%_]/g, value => `[${value}]`)}%`
  const neighborhoodLike = `%${neighborhoodQuery.replace(/[\[%_]/g, value => `[${value}]`)}%`
  const numeric = Number(query.replace(/^#/, ''))
  const byCode = Number.isInteger(numeric) && numeric > 0
  return prisma.$queryRaw<Array<Record<string, any>>>`
    ;WITH UltimosPlantoes AS (
      SELECT sh.Pedido, MAX(CAST(sh.Data AS date)) AS UltimoPlantao
      FROM Servico1 sh
      WHERE (sh.Deletar IS NULL OR sh.Deletar <> N'S')
      GROUP BY sh.Pedido
    ),
    EscalasComEquipe AS (
      SELECT sv.Pedido
      FROM Servico sv
      WHERE COALESCE(sv.CodInd, 0) > 0 OR COALESCE(sv.CodInd2, 0) > 0 OR COALESCE(sv.CodInd3, 0) > 0
      UNION
      SELECT sh.Pedido
      FROM Servico1 sh
      WHERE (sh.Deletar IS NULL OR sh.Deletar <> N'S')
        AND sh.Data < DATEADD(day, 1, CAST(${dateKey} AS date))
        AND (COALESCE(sh.CodInd, 0) > 0 OR COALESCE(sh.CodInd2, 0) > 0 OR COALESCE(sh.CodInd3, 0) > 0)
    ),
    EscalasAtivas AS (
      SELECT sv.Pedido, sv.CodCli, sv.CodCli1, sv.DataInicio, sv.DataSaida,
        sv.Responsavel, sv.Cliente1, up.UltimoPlantao
      FROM Servico sv
      INNER JOIN EscalasComEquipe equipe ON equipe.Pedido = sv.Pedido
      LEFT JOIN UltimosPlantoes up ON up.Pedido = sv.Pedido
      WHERE sv.DataInicio IS NOT NULL
        AND sv.DataInicio < DATEADD(day, 1, CAST(${dateKey} AS date))
        AND (sv.Status IS NULL OR LTRIM(RTRIM(sv.Status)) IN (N'', N'ATIVO', N'ATIVA'))
        AND (sv.DataSaida IS NULL OR sv.DataSaida >= CAST(${dateKey} AS date)
          OR (sv.DataSaida < sv.DataInicio AND CAST(${dateKey} AS date) <= up.UltimoPlantao))
    )
    SELECT TOP (${safeLimit})
      c.CodCli AS id, c.CodCli1 AS responsavel_id,
      COALESCE(NULLIF(LTRIM(RTRIM(c.Cliente)), ''), c.Razao) AS nome,
      c.Razao AS razao, COALESCE(c.CPF, c.CGC) AS cpf_cnpj,
      c.Sexo AS sexo, c.Tel AS telefone, c.Tel2 AS celular, c.EMail AS email,
      c.Endereco AS endereco, c.Complemento AS complemento, c.Numero AS numero,
      c.Bairro AS bairro, c.Cidade AS cidade, c.Estado AS estado, c.Cep AS cep,
      c.Situacao AS situacao,
      TRY_CONVERT(date, CONCAT(c.Ano_Nasc, '-', RIGHT('0' + CAST(c.Mes_Nasc AS varchar(2)), 2), '-', RIGHT('0' + CAST(c.Dia_Nasc AS varchar(2)), 2)), 23) AS data_nascimento,
      COALESCE(NULLIF(LTRIM(RTRIM(resp.Cliente)), ''), resp.Razao) AS responsavel_nome,
      seg.Segmento AS segmento, c.CodSeg AS cod_segmento,
      CAST(sc.Pedido AS int) AS escala_id,
      sc.DataInicio AS escala_inicio,
      sc.DataSaida AS escala_fim,
      sc.Responsavel AS escala_responsavel, sc.Contratante AS escala_contratante
    FROM CLIENTEs c
    LEFT JOIN CLIENTEs resp ON resp.CodCli = c.CodCli1
    LEFT JOIN Segmento seg ON seg.CodSeg = c.CodSeg
    OUTER APPLY (
      SELECT TOP 1 sv.Pedido, sv.DataInicio,
        CASE WHEN sv.DataSaida < sv.DataInicio THEN sv.UltimoPlantao ELSE sv.DataSaida END AS DataSaida,
        sv.Responsavel,
        COALESCE(NULLIF(LTRIM(RTRIM(respEscala.Cliente)), ''), respEscala.Razao, NULLIF(LTRIM(RTRIM(sv.Cliente1)), '')) AS Contratante
      FROM EscalasAtivas sv
      LEFT JOIN CLIENTEs respEscala ON respEscala.CodCli = COALESCE(sv.CodCli1, c.CodCli1)
      WHERE (sv.CodCli = c.CodCli OR sv.CodCli = c.CodCli1)
      ORDER BY sv.DataInicio DESC, sv.Pedido DESC
    ) sc
    WHERE (c.Situacao IS NULL OR LTRIM(RTRIM(c.Situacao)) IN (N'', N'A')) AND c.InativoDesde IS NULL
      AND (UPPER(seg.Segmento) LIKE N'%PACIENTE%' OR UPPER(seg.Segmento) LIKE N'%IDOSO%' OR c.CodSeg = 2)
      AND sc.Pedido IS NOT NULL
      AND (${query} = N'' OR c.Cliente LIKE ${like} OR c.Razao LIKE ${like} OR c.CPF LIKE ${like} OR c.CGC LIKE ${like} OR c.Bairro LIKE ${like}
        OR (${byCode ? 1 : 0} = 1 AND c.CodCli = ${byCode ? numeric : 0}))
      AND (${neighborhoodQuery} = N'' OR (${exactNeighborhood ? 1 : 0} = 1
        AND UPPER(LTRIM(RTRIM(ISNULL(c.Bairro, N'')))) = UPPER(LTRIM(RTRIM(${neighborhoodQuery})))
        OR ${exactNeighborhood ? 0 : 1} = 1 AND c.Bairro LIKE ${neighborhoodLike}))
    ORDER BY COALESCE(NULLIF(LTRIM(RTRIM(c.Cliente)), ''), c.Razao), c.CodCli
  `
}
