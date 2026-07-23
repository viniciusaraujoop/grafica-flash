# Checklist de migração Mercado Pago para Asaas

Preencha `Obtido`, `Status` e `Evidência` durante a validação.

## P0

| Teste | Pré-condição | Passos | Esperado | Obtido | Status | Evidência |
|---|---|---|---|---|---|---|
| Mercado Pago preservado | Deploy atual operacional | Fazer compra de teste pelo fluxo legado | Fluxo legado continua disponível |  |  |  |
| Fallback sem flag | Empresa sem provider Asaas | Abrir checkout | Mercado Pago permanece selecionado |  |  |  |
| Empresa piloto | Provider `asaas` e sandbox | Abrir checkout V2 | Checkout próprio é carregado |  |  |  |
| Isolamento | Duas empresas | Consultar transações | Uma empresa não vê a outra |  |  |  |
| Subconta única | Empresa sem conta | Criar duas vezes | Segunda tentativa reutiliza registro |  |  |  |
| Criptografia | Chave configurada | Inspecionar banco | API key não aparece em texto puro |  |  |  |
| Pix | Conta aprovada | Criar cobrança sandbox | QR Code e copia e cola são exibidos |  |  |  |
| Idempotência pedido | Mesmo clique/chave | Repetir requisição | Mesmo pedido/pagamento é retornado |  |  |  |
| Webhook duplicado | Evento recebido | Reenviar evento | Nenhum lançamento é duplicado |  |  |  |
| Split Essencial | Plano Essencial | Pagar sandbox | 3% sobre líquido para raiz |  |  |  |
| Split Profissional | Plano Profissional | Pagar sandbox | 2% sobre líquido para raiz |  |  |  |
| Split Premium | Plano Premium | Pagar sandbox | 1% sobre líquido para raiz |  |  |  |
| Financeiro | Pagamento confirmado | Processar webhook | Uma entrada vinculada ao pedido |  |  |  |
| Trial | Trial já utilizado | Reativar/trocar plano | Trial não reinicia |  |  |  |
| Cancelamento | Assinatura ativa | Cancelar sandbox | Provider cancela antes do local |  |  |  |
| Rollback | Empresa piloto Asaas | Executar rollback | Provider volta a Mercado Pago |  |  |  |

## P1

Validar cartão sandbox, cupom, entrega, retirada, estorno, comissão, repasse, conta bloqueada, webhook inválido, token inválido e conciliação.

## P2

Validar mobile em 320px e 768px, desktop, Chrome, Safari, Firefox, teclado, foco, contraste, QR Code, loading, erros e Open Graph.
