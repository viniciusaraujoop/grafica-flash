import 'server-only'

import type { AssistantResult } from '@/lib/assistant/types'

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolveCommercialObjection(value: string): AssistantResult | null {
  const text = normalized(value)

  if (/ja uso whatsapp|uso whatsapp/.test(text)) {
    return {
      answer: 'Você não precisa abandonar o WhatsApp. A proposta do Orçaly é tirar dele o trabalho de ser catálogo, histórico, CRM e controle de pedidos ao mesmo tempo. O WhatsApp continua como canal; o Orçaly organiza o que acontece antes e depois da conversa.',
      suggestions: ['Ver para meu negócio', 'Vocês têm CRM?', 'Comparar planos'],
      source: 'tool',
      tool: 'objection_whatsapp',
    }
  }

  if (/ja tenho (um )?site|tenho (um )?site/.test(text)) {
    return {
      answer: 'Ter site já resolve presença digital, mas não necessariamente organiza pedidos, clientes, propostas e execução. O ponto é comparar o que seu site já faz com o fluxo operacional que você ainda controla fora dele. Não faz sentido trocar algo que já funciona sem ganho claro.',
      suggestions: ['Quais recursos vocês têm?', 'Ver para meu negócio', 'Comparar planos'],
      source: 'tool',
      tool: 'objection_site',
    }
  }

  if (/esta caro|ta caro|muito caro|caro pra mim/.test(text)) {
    return {
      answer: 'Faz sentido comparar o custo com o que você realmente vai usar. Eu não vou empurrar o Premium: posso identificar o menor plano que atende sua rotina e você decide se o ganho de organização justifica o valor.',
      suggestions: ['Qual plano faz sentido para mim?', 'Quanto custa?', 'Sou pequeno'],
      source: 'tool',
      tool: 'objection_price',
    }
  }

  if (/sou pequeno|empresa pequena|trabalho sozinho|so eu|só eu|nao tenho equipe|não tenho equipe/.test(text)) {
    return {
      answer: 'Equipe pequena é justamente um motivo para evitar processos espalhados. Se você só precisa organizar presença digital, pedidos e clientes, não há razão para começar pelo plano mais avançado. Posso avaliar o Básico primeiro.',
      suggestions: ['Qual plano faz sentido para mim?', 'Ver para meu negócio', 'Quanto custa?'],
      source: 'tool',
      tool: 'objection_small_business',
    }
  }

  if (/uso planilha|uso excel|minha planilha/.test(text)) {
    return {
      answer: 'Planilha pode funcionar muito bem para controle pontual. O Orçaly passa a fazer sentido quando você quer conectar entrada do cliente, pedido, proposta, acompanhamento e rotina operacional sem atualizar tudo manualmente em lugares diferentes.',
      suggestions: ['Ver como funciona', 'Ver para meu negócio', 'Qual plano faz sentido para mim?'],
      source: 'tool',
      tool: 'objection_spreadsheet',
    }
  }

  if (/nao entendi a diferenca|não entendi a diferença|qual a diferenca dos planos|qual a diferença dos planos/.test(text)) {
    return {
      answer: 'A diferença é o quanto de operação você quer organizar: Básico cobre a base digital e pedidos; Intermediário acrescenta acompanhamento comercial, propostas, follow-up e relatórios; Premium entra quando automações e recuperação de oportunidades passam a ser necessárias.',
      suggestions: ['Comparar planos', 'Qual plano faz sentido para mim?', 'Quanto custa?'],
      source: 'tool',
      tool: 'objection_plan_difference',
    }
  }

  return null
}
