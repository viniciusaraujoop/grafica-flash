# Checklist QA Manual do Orcaly

Preencha Resultado obtido e Status durante a execucao manual.

## P0

### P0-001 - Login

- Area: Login
- Pre-condicao: Usuario de teste valido
- Passos: Acessar /login; informar credenciais; entrar
- Resultado esperado: Usuario entra e vai ao painel
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Captura da tela e URL

### P0-002 - Logout

- Area: Logout
- Pre-condicao: Usuario autenticado
- Passos: Acionar logout; voltar no navegador
- Resultado esperado: Sessao termina e painel fica protegido
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Video curto ou capturas

### P0-003 - Sessao

- Area: Sessao
- Pre-condicao: Usuario autenticado
- Passos: Recarregar; fechar/abrir aba; aguardar expiracao controlada
- Resultado esperado: Sessao permanece ou renova sem expor token
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Console e capturas

### P0-004 - Multiempresa

- Area: Multiempresa
- Pre-condicao: Duas empresas e dois usuarios
- Passos: Criar registro na empresa A; consultar pela empresa B
- Resultado esperado: Empresa B nao le nem altera dados da A
- Resultado obtido: 
- Status: 
- Evidencia necessaria: IDs mascarados e consultas

### P0-005 - Webhook

- Area: Webhook
- Pre-condicao: Conta Mercado Pago de teste
- Passos: Gerar pagamento teste; repetir notificacao
- Resultado esperado: Status atualiza uma vez e sem duplicar financeiro
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Logs e IDs de teste mascarados

### P0-006 - Trial

- Area: Trial
- Pre-condicao: Empresa nunca assinante
- Passos: Iniciar assinatura; conferir datas; tentar nova adesao
- Resultado esperado: Trial dura 7 dias e nao reinicia
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas e dados mascarados

### P0-007 - Cancelamento

- Area: Cancelamento
- Pre-condicao: Assinatura de teste ativa
- Passos: Cancelar; simular falha externa; repetir webhook antigo
- Resultado esperado: Falha nao cancela localmente; acesso preservado; evento antigo nao reativa
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Logs mascarados

### P0-008 - Pix

- Area: Pix
- Pre-condicao: Empresa elegivel
- Passos: Escolher Pix; gerar cobranca; concluir em sandbox
- Resultado esperado: Nao cobra no primeiro dia do trial quando aplicavel
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas sandbox

### P0-009 - Cartao recorrente

- Area: Cartao recorrente
- Pre-condicao: Cartao de teste
- Passos: Criar recorrencia; validar preapproval; cancelar
- Resultado esperado: Recorrencia e cancelamento consistentes
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas sandbox

## P1

### P1-001 - Funcionario

- Area: Funcionario
- Pre-condicao: Proprietario autenticado
- Passos: Adicionar; aceitar convite; remover acesso
- Resultado esperado: Vinculo correto e historico preservado
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas e logs

### P1-002 - Business type

- Area: Business type
- Pre-condicao: Empresa sem ramo e empresa com ramo
- Passos: Definir uma vez; tentar alterar novamente
- Resultado esperado: Primeira definicao aceita; segunda rejeitada no servidor
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Resposta da API mascarada

### P1-003 - Slug

- Area: Slug
- Pre-condicao: Empresa autenticada
- Passos: Testar reservado, ocupado, proprio e valido
- Resultado esperado: Normalizacao e disponibilidade corretas
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas

### P1-004 - Produto

- Area: Produto
- Pre-condicao: Empresa Food
- Passos: Criar, editar, desativar e excluir produto
- Resultado esperado: CRUD persiste apenas na empresa atual
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas

### P1-005 - Pedido

- Area: Pedido
- Pre-condicao: Loja publica configurada
- Passos: Montar carrinho; finalizar; conferir painel
- Resultado esperado: Pedido, itens e totais recalculados no servidor
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas e pedido teste

### P1-006 - Cupom

- Area: Cupom
- Pre-condicao: Cupom de teste valido
- Passos: Aplicar abaixo/acima do minimo; expirar; exceder limite
- Resultado esperado: Servidor rejeita casos invalidos
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas

### P1-007 - Food

- Area: Food
- Pre-condicao: Produtos com variacao/adicional
- Passos: Adicionar itens, alterar quantidades e observacoes
- Resultado esperado: Subtotal considera variacoes e adicionais multiplicados
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas

### P1-008 - Entrega

- Area: Entrega
- Pre-condicao: Zona e retirada configuradas
- Passos: Testar endereco valido/invalido e retirada
- Resultado esperado: Taxa/minimo corretos; retirada sem delivery
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas

### P1-009 - Configuracoes

- Area: Configuracoes
- Pre-condicao: Empresa autenticada
- Passos: Editar dados e logo; recarregar
- Resultado esperado: Dados persistem sem alterar ramo
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas

## P2

### P2-001 - Rotas

- Area: Rotas
- Pre-condicao: Build implantado
- Passos: Abrir menus desktop/mobile e links principais
- Resultado esperado: Sem 404 e sem pagina intermediaria de assinatura
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Lista de URLs

### P2-002 - Site publico

- Area: Site publico
- Pre-condicao: Slug publicado
- Passos: Abrir subdominio e compartilhar URL
- Resultado esperado: Site abre em https://slug.orcaly.com.br
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas

### P2-003 - WhatsApp

- Area: WhatsApp
- Pre-condicao: Site publico acessivel
- Passos: Compartilhar URL no WhatsApp
- Resultado esperado: Preview usa titulo, descricao e OG corretos
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Captura do preview

### P2-004 - Chrome favicon

- Area: Chrome favicon
- Pre-condicao: Deploy concluido
- Passos: Limpar cache; abrir site em nova aba
- Resultado esperado: Favicon do Orcaly aparece
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Captura da aba

## P3

### P3-001 - Mobile 360px

- Area: Mobile 360px
- Pre-condicao: Navegador com DevTools
- Passos: Testar painel, tabelas, modais e formularios
- Resultado esperado: Sem overflow; botoes utilizaveis
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas 360px

### P3-002 - Mobile 390px

- Area: Mobile 390px
- Pre-condicao: Navegador com DevTools
- Passos: Repetir fluxo principal
- Resultado esperado: Layout consistente e legivel
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Capturas 390px

### P3-003 - Acessibilidade

- Area: Acessibilidade
- Pre-condicao: Navegador desktop
- Passos: Navegar por teclado; reduzir movimento
- Resultado esperado: Foco visivel e animacoes reduzidas
- Resultado obtido: 
- Status: 
- Evidencia necessaria: Video curto

