# Atendimento Clínico Cuida Amor

Aplicação Next.js independente para agenda de visitas, prontuário de atendimento, plano de cuidado e relatórios clínicos. O frontend e as APIs ficam neste projeto; os dados continuam no mesmo SQL Server e nas tabelas compartilhadas com o SoftCare principal.

## Desenvolvimento local

1. Instale as dependências nesta pasta com `npm install`.
2. Configure `DATABASE_URL` e `JWT_SECRET` no `.env` desta pasta. Use os mesmos valores do SoftCare principal para compartilhar o banco e validar a mesma sessão JWT.
3. Inicie somente este app com `npm run dev`; ele carrega as variáveis daqui e abre em `http://localhost:3002`.

O servidor principal na porta 3000 não é necessário para operar o Atendimento Clínico. O projeto tem seu próprio Prisma Client, autenticação, rotas de API e sessão `httpOnly`; todas as operações acessam diretamente o banco compartilhado. O segredo JWT precisa ser o mesmo usado pelo SoftCare principal.

## Implantação independente

Configure `DATABASE_URL` e `JWT_SECRET` no ambiente do deploy usando os mesmos valores do sistema principal. Configure também `SESSION_COOKIE_SECURE=true` quando servido por HTTPS. Não versione o arquivo `.env` nem compartilhe seus valores.

O schema Prisma local é mínimo e usa consultas SQL parametrizadas para ler o schema legado compartilhado. Na primeira chamada às APIs clínicas, o serviço cria, quando necessário, as tabelas de visitas, evoluções, plano de cuidado, auditoria, rascunhos e intercorrências, além dos campos de satisfação e autorização clínica usados pelo módulo. A conta SQL do ambiente precisa ter permissão para criar/alterar essas tabelas e colunas.

## Acesso

O login consulta a tabela `Senha`. O Perfil 3 e o usuário Otávio (`CodUsu` 59) têm acesso administrativo completo. Profissionais do Perfil 6 precisam estar habilitados individualmente para atendimento clínico no campo `AtendimentoClinico`.

O agendamento considera somente idosos ativos com uma escala ativa, equipe atribuída e período cobrindo a data escolhida. O backend impede conflitos de agenda para a mesma enfermeira com intervalo inferior a 90 minutos.
