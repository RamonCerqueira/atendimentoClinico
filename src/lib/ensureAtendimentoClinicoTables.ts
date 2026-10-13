import { prisma } from '@/lib/prisma'

let ready = false
let readyPromise: Promise<void> | null = null

export async function ensureAtendimentoClinicoTables() {
  if (ready) return
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      IF OBJECT_ID(N'AtendimentoClinicoVisita', N'U') IS NULL
      BEGIN
        CREATE TABLE AtendimentoClinicoVisita (
          VisitaId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          CodCli INT NOT NULL,
          EnfermeiraCodUsu INT NOT NULL,
          DataHora DATETIME2 NOT NULL,
          Status NVARCHAR(20) NOT NULL CONSTRAINT DF_AtClinVis_Status DEFAULT N'PENDENTE',
          CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_AtClinVis_CriadoEm DEFAULT SYSUTCDATETIME(),
          IniciadoEm DATETIME2 NULL,
          FinalizadoEm DATETIME2 NULL
        );
        CREATE INDEX IX_AtClinVis_DataHora ON AtendimentoClinicoVisita(DataHora, Status);
        CREATE INDEX IX_AtClinVis_CodCli ON AtendimentoClinicoVisita(CodCli, DataHora DESC);
        CREATE INDEX IX_AtClinVis_Enfermeira ON AtendimentoClinicoVisita(EnfermeiraCodUsu, DataHora, Status);
      END
      ELSE BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'IniciadoEm' AND Object_ID=Object_ID(N'AtendimentoClinicoVisita')) ALTER TABLE AtendimentoClinicoVisita ADD IniciadoEm DATETIME2 NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'FinalizadoEm' AND Object_ID=Object_ID(N'AtendimentoClinicoVisita')) ALTER TABLE AtendimentoClinicoVisita ADD FinalizadoEm DATETIME2 NULL;
      END
      IF OBJECT_ID(N'AtendimentoClinicoEvolucao', N'U') IS NULL
      BEGIN
        CREATE TABLE AtendimentoClinicoEvolucao (
          EvolucaoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          CodCli INT NOT NULL, EnfermeiraCodUsu INT NOT NULL, VisitaId INT NULL,
          DataHora DATETIME2 NOT NULL CONSTRAINT DF_AtClinEvo_DataHora DEFAULT SYSUTCDATETIME(),
          PressaoArterial NVARCHAR(30) NULL, Spo2 NVARCHAR(20) NULL, FrequenciaCardiaca NVARCHAR(20) NULL,
          Temperatura NVARCHAR(20) NULL, FrequenciaRespiratoria NVARCHAR(20) NULL, Hgt NVARCHAR(20) NULL,
          Consciencia NVARCHAR(30) NULL, CondicaoGeral NVARCHAR(30) NULL, Pele NVARCHAR(500) NULL,
          Observacoes NVARCHAR(MAX) NULL, PossuiLpp NVARCHAR(10) NULL, LocalizacaoLpp NVARCHAR(300) NULL,
          GrauLpp NVARCHAR(50) NULL, Curativos NVARCHAR(300) NULL, Lesoes NVARCHAR(MAX) NULL, Satisfacao NVARCHAR(MAX) NULL,
          SatisfacaoMonitoramentoSemana TINYINT NULL, SatisfacaoMonitoramentoFimSemana TINYINT NULL,
          SatisfacaoEquipeManha TINYINT NULL, SatisfacaoEquipeTarde TINYINT NULL,
          SatisfacaoMonitoramentoComunicacao TINYINT NULL, SatisfacaoSuporteEnfermagem TINYINT NULL,
          SatisfacaoCuidadoresDia TINYINT NULL, SatisfacaoCuidadoresNoite TINYINT NULL
        );
        CREATE INDEX IX_AtClinEvo_CodCli_DataHora ON AtendimentoClinicoEvolucao(CodCli, DataHora DESC);
      END
      ELSE BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'SatisfacaoMonitoramentoSemana' AND Object_ID=Object_ID(N'AtendimentoClinicoEvolucao')) ALTER TABLE AtendimentoClinicoEvolucao ADD SatisfacaoMonitoramentoSemana TINYINT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'SatisfacaoMonitoramentoFimSemana' AND Object_ID=Object_ID(N'AtendimentoClinicoEvolucao')) ALTER TABLE AtendimentoClinicoEvolucao ADD SatisfacaoMonitoramentoFimSemana TINYINT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'SatisfacaoEquipeManha' AND Object_ID=Object_ID(N'AtendimentoClinicoEvolucao')) ALTER TABLE AtendimentoClinicoEvolucao ADD SatisfacaoEquipeManha TINYINT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'SatisfacaoEquipeTarde' AND Object_ID=Object_ID(N'AtendimentoClinicoEvolucao')) ALTER TABLE AtendimentoClinicoEvolucao ADD SatisfacaoEquipeTarde TINYINT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'SatisfacaoMonitoramentoComunicacao' AND Object_ID=Object_ID(N'AtendimentoClinicoEvolucao')) ALTER TABLE AtendimentoClinicoEvolucao ADD SatisfacaoMonitoramentoComunicacao TINYINT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'SatisfacaoSuporteEnfermagem' AND Object_ID=Object_ID(N'AtendimentoClinicoEvolucao')) ALTER TABLE AtendimentoClinicoEvolucao ADD SatisfacaoSuporteEnfermagem TINYINT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'SatisfacaoCuidadoresDia' AND Object_ID=Object_ID(N'AtendimentoClinicoEvolucao')) ALTER TABLE AtendimentoClinicoEvolucao ADD SatisfacaoCuidadoresDia TINYINT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'SatisfacaoCuidadoresNoite' AND Object_ID=Object_ID(N'AtendimentoClinicoEvolucao')) ALTER TABLE AtendimentoClinicoEvolucao ADD SatisfacaoCuidadoresNoite TINYINT NULL;
      END
      IF OBJECT_ID(N'AtendimentoClinicoPlanoCuidado', N'U') IS NULL
      BEGIN
        CREATE TABLE AtendimentoClinicoPlanoCuidado (
          PlanoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, CodCli INT NOT NULL, EnfermeiraCodUsu INT NOT NULL,
          Objetivos NVARCHAR(MAX) NULL, Cuidados NVARCHAR(MAX) NULL, Riscos NVARCHAR(MAX) NULL, Contatos NVARCHAR(MAX) NULL,
          RevisarEm DATE NULL, CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_AtClinPlano_CriadoEm DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX IX_AtClinPlano_CodCli_CriadoEm ON AtendimentoClinicoPlanoCuidado(CodCli, CriadoEm DESC);
      END
      IF OBJECT_ID(N'AtendimentoClinicoAuditoria', N'U') IS NULL
      BEGIN
        CREATE TABLE AtendimentoClinicoAuditoria (
          AuditoriaId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY, CodUsu INT NOT NULL, Acao NVARCHAR(60) NOT NULL,
          Entidade NVARCHAR(60) NOT NULL, EntidadeId NVARCHAR(80) NULL, CodCli INT NULL, Detalhes NVARCHAR(500) NULL,
          CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_AtClinAud_CriadoEm DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX IX_AtClinAud_Paciente_CriadoEm ON AtendimentoClinicoAuditoria(CodCli, CriadoEm DESC);
        CREATE INDEX IX_AtClinAud_Usuario_CriadoEm ON AtendimentoClinicoAuditoria(CodUsu, CriadoEm DESC);
      END
      IF OBJECT_ID(N'AtendimentoClinicoRascunho', N'U') IS NULL
      BEGIN
        CREATE TABLE AtendimentoClinicoRascunho (
          RascunhoId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, CodCli INT NOT NULL, EnfermeiraCodUsu INT NOT NULL,
          VisitaId INT NULL, Dados NVARCHAR(MAX) NOT NULL, AtualizadoEm DATETIME2 NOT NULL CONSTRAINT DF_AtClinRascunho_AtualizadoEm DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX IX_AtClinRascunho_Profissional ON AtendimentoClinicoRascunho(EnfermeiraCodUsu, AtualizadoEm DESC);
      END
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE Name=N'UX_AtClinRascunho_Visita' AND Object_ID=Object_ID(N'AtendimentoClinicoRascunho'))
        CREATE UNIQUE INDEX UX_AtClinRascunho_Visita ON AtendimentoClinicoRascunho(VisitaId, EnfermeiraCodUsu) WHERE VisitaId IS NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE Name=N'UX_AtClinRascunho_Paciente' AND Object_ID=Object_ID(N'AtendimentoClinicoRascunho'))
        CREATE UNIQUE INDEX UX_AtClinRascunho_Paciente ON AtendimentoClinicoRascunho(CodCli, EnfermeiraCodUsu) WHERE VisitaId IS NULL;
      IF OBJECT_ID(N'AtendimentoClinicoIntercorrencia', N'U') IS NULL
      BEGIN
        CREATE TABLE AtendimentoClinicoIntercorrencia (
          IntercorrenciaId INT IDENTITY(1,1) NOT NULL PRIMARY KEY, CodCli INT NOT NULL, VisitaId INT NULL,
          EnfermeiraCodUsu INT NOT NULL, Categoria NVARCHAR(80) NOT NULL, Gravidade NVARCHAR(20) NOT NULL,
          Relato NVARCHAR(MAX) NOT NULL, Conduta NVARCHAR(MAX) NULL, Encaminhamento NVARCHAR(300) NULL,
          Status NVARCHAR(30) NOT NULL CONSTRAINT DF_AtClinInter_Status DEFAULT N'ABERTA',
          DataHora DATETIME2 NOT NULL CONSTRAINT DF_AtClinInter_DataHora DEFAULT SYSUTCDATETIME(),
          ResolvidaEm DATETIME2 NULL, ResolvidaPor INT NULL
        );
        CREATE INDEX IX_AtClinInter_Paciente_DataHora ON AtendimentoClinicoIntercorrencia(CodCli, DataHora DESC);
        CREATE INDEX IX_AtClinInter_Status_DataHora ON AtendimentoClinicoIntercorrencia(Status, DataHora DESC);
      END
    `)
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'Equipe' AND Object_ID=Object_ID(N'Senha')) ALTER TABLE Senha ADD Equipe VARCHAR(100) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'AtendimentoClinico' AND Object_ID=Object_ID(N'Senha')) ALTER TABLE Senha ADD AtendimentoClinico BIT NOT NULL CONSTRAINT DF_Senha_AtendimentoClinico DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'Supervisor' AND Object_ID=Object_ID(N'Senha')) ALTER TABLE Senha ADD Supervisor VARCHAR(1) NULL;
    `)
    ready = true
  })()
  try { await readyPromise } finally { readyPromise = null }
}
