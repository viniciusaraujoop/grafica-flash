# API pública do Orçaly

A API pública começa em `/api/v1` e usa uma API key vinculada a uma única empresa. Crie a chave no Hub de Integrações com MFA: o valor bruto aparece somente nessa resposta e não é armazenado pelo Orçaly.

## Autenticação

Envie a chave em todas as chamadas:

```http
Authorization: Bearer orcaly_live_<identificador>_<segredo>
```

As chaves podem receber os escopos `customers.read`, `customers.write`, `orders.read`, `orders.write`, `tasks.write` e `webhooks.manage`. Revogação é imediata e também exige MFA.

## Endpoint disponível

`GET /api/v1/health` confirma a credencial e retorna sua versão, empresa vinculada, identificador da chave e escopos. Ele não retorna nenhum segredo.

Os recursos de clientes, pedidos, tarefas e webhooks serão expostos por endpoints específicos somente depois que cada contrato canônico e respectiva autorização estiverem implementados. Não há endpoint genérico que aceite IDs de outra empresa.
