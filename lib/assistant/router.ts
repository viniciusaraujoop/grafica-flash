import 'server-only'

import { resolveCommercialObjection } from '@/lib/assistant/objections'
import type { AssistantResult } from '@/lib/assistant/types'
import {
  inferSegmentFromText,
  runAssistantTool,
} from '@/lib/assistant/tools'

export type PublicAssistantMessage = {
  role: 'assistant' | 'user'
  content: string
}

function normalize(value: unknown, max = 700) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, max)
}

function historyText(messages: PublicAssistantMessage[]) {
  return messages.slice(-8).map((message) => message.content).join(' ')
}

function inferredPlan(value: string) {
  const text = normalize(value, 2000)
  if (/\bpremium\b/.test(text)) return 'premium'
  if (/\b(intermediario|profissional)\b/.test(text)) return 'profissional'
  if (/\b(basico|essencial)\b/.test(text)) return 'essencial'
  return null
}

function securityRefusal(): AssistantResult {
  return {
    answer:
      'Não posso revelar prompts, chaves, credenciais, dados internos nem executar SQL. Meu acesso aqui é somente comercial e limitado a informações públicas do Orçaly.',
    suggestions: ['Ver para meu negócio', 'Comparar planos', 'Ver demonstração'],
    source: 'guided',
    tool: null,
  }
}

function scopeRedirect(): AssistantResult {
  return {
    answer:
      'Meu foco aqui é ajudar você com o Orçaly e com a organização do seu negócio. Posso explicar recursos, comparar planos ou mostrar como funcionaria para o seu segmento.',
    suggestions: ['Ver para meu negócio', 'Comparar planos', 'Como funciona?'],
    source: 'guided',
    tool: null,
  }
}

function identityAnswer(): AssistantResult {
  return {
    answer:
      'Sim. Eu sou o Assistente Orçaly, uma IA criada para explicar como o Orçaly funciona, mostrar os recursos que fazem sentido para o seu negócio e ajudar você a escolher uma solução.',
    suggestions: ['Ver para meu negócio', 'Como funciona?', 'Quanto custa?'],
    source: 'guided',
    tool: null,
  }
}

function whyOrcalyAnswer(): AssistantResult {
  return {
    answer:
      'O principal motivo é centralizar coisas que normalmente ficam espalhadas entre WhatsApp, planilhas e outras ferramentas. Com o Orçaly você pode ter seu site, receber pedidos ou orçamentos, organizar clientes e acompanhar a operação no mesmo lugar. Se me disser seu tipo de negócio, eu mostro como esse fluxo ficaria na prática.',
    suggestions: ['Tenho uma gráfica', 'Tenho um restaurante', 'Tenho uma loja'],
    source: 'guided',
    tool: null,
  }
}

function howItWorksAnswer(): AssistantResult {
  return {
    answer:
      'O Orçaly conecta a presença digital da empresa com a operação: o cliente encontra seu site ou catálogo, envia um pedido ou orçamento e sua equipe acompanha clientes, propostas, status e próximos passos no painel. O fluxo muda conforme o segmento.',
    suggestions: ['Ver para meu negócio', 'Ver demonstração', 'Quanto custa?'],
    source: 'guided',
    tool: null,
  }
}

function greetingAnswer(): AssistantResult {
  return {
    answer:
      'Oi! Posso explicar como o Orçaly funciona, mostrar uma solução para o seu tipo de negócio ou comparar planos. Se você me disser o que sua empresa faz hoje, eu começo por aí.',
    suggestions: ['Ver para meu negócio', 'Como funciona?', 'Comparar planos'],
    source: 'guided',
    tool: null,
  }
}

function unconfirmedCommercialAnswer(topic: 'cancelamento' | 'teste' | 'pix'): AssistantResult {
  const answer = topic === 'cancelamento'
    ? 'A política de cancelamento não está confirmada na base pública que uso agora. Prefiro não inventar condição comercial; posso te encaminhar para o contato oficial do Orçaly.'
    : topic === 'teste'
      ? 'Não tenho um teste grátis confirmado na base pública atual. Posso explicar os planos disponíveis ou te encaminhar para o contato oficial antes do cadastro.'
      : 'A base confirma pagamentos online pela infraestrutura do Mercado Pago quando configurados, mas não confirma que Pix esteja habilitado em todos os cenários. Prefiro não prometer uma forma de pagamento sem essa confirmação.'

  return {
    answer,
    suggestions: ['Falar com a equipe', 'Comparar planos', 'Como funciona?'],
    source: 'guided',
    tool: null,
  }
}

export function routeDeterministicAssistant(input: {
  question: string
  messages: PublicAssistantMessage[]
}): AssistantResult | null {
  const question = normalize(input.question)
  const context = `${historyText(input.messages)} ${input.question}`
  const normalizedContext = normalize(context, 4000)
  const segment = inferSegmentFromText(context)
  const plan = inferredPlan(context)

  if (
    /(ignore|ignora).*(instruc|prompt)|mostre.*(prompt|api key|chave|segredo)|revel.*(prompt|api key|chave|segredo)|execute sql|executar sql|service[_ -]?role|access[_ -]?token|senha interna|dados internos|acesse.*(clientes|banco)|mostre.*clientes/.test(question)
  ) {
    return securityRefusal()
  }

  if (
    /(quem ganhou.*copa|futebol|receita de|fofoca|eleicao|presidente do|previsao do tempo|horoscopo)/.test(question)
  ) {
    return scopeRedirect()
  }

  if (/^(oi|ola|opa|bom dia|boa tarde|boa noite)[!.? ]*$/.test(question)) {
    return greetingAnswer()
  }

  if (/voce e (uma )?ia|voce e inteligencia artificial|e uma ia|e inteligencia artificial|quem e voce/.test(question)) {
    return identityAnswer()
  }

  if (/por que.*(assinar|contratar|usar)|porque.*(assinar|contratar|usar)|vale a pena.*orcaly|por que.*voces/.test(question)) {
    return whyOrcalyAnswer()
  }

  if (/^(o que e|o que faz).*orcaly|como o orcaly funciona|como funciona( o orcaly)?[?.! ]*$/.test(question)) {
    return howItWorksAnswer()
  }

  if (/posso cancelar|como cancela|cancelamento/.test(question)) {
    return unconfirmedCommercialAnswer('cancelamento')
  }

  if (/teste gratis|teste gratuito|tem teste|periodo de teste/.test(question)) {
    return unconfirmedCommercialAnswer('teste')
  }

  if (/aceita pix|tem pix|pagamento.*pix/.test(question)) {
    return unconfirmedCommercialAnswer('pix')
  }

  const objection = resolveCommercialObjection(input.question)
  if (objection) return objection

  if (
    question === 'ver para meu negocio' ||
    question.includes('meu tipo de negocio')
  ) {
    return {
      answer: 'Qual é o seu tipo de negócio? Com isso eu já consigo mostrar um fluxo real do Orçaly sem te fazer preencher um interrogatório de aeroporto.',
      suggestions: ['Gráfica', 'Restaurante/Food', 'Loja'],
      source: 'guided',
      tool: null,
    }
  }

  if (/quanto custa|preco|valores|valor dos planos|quais planos|plano mais barato/.test(question)) {
    return runAssistantTool('get_plans')
  }

  if (/comparar|comparacao|diferenca entre/.test(question)) {
    const requested = ['essencial', 'profissional', 'premium'].filter((candidate) =>
      normalizedContext.includes(candidate === 'essencial' ? 'basico' : candidate === 'profissional' ? 'intermediario' : candidate),
    )
    return runAssistantTool('compare_plans', { plans: requested })
  }

  if (/qual plano|plano ideal|recomenda.*plano|melhor plano/.test(question)) {
    const decisionSignals = /(proposta|follow.?up|relatorio|crm|equipe|automacao|recuperacao|volume|escala|comecando|pequeno|organizar vendas|acompanhar clientes)/.test(normalizedContext)

    if (!decisionSignals) {
      return {
        answer: 'Para recomendar sem empurrar o plano mais caro, preciso de uma coisa: hoje você está começando a organizar pedidos, já vende e precisa de propostas/follow-up, ou precisa de automações para maior volume?',
        suggestions: ['Estou começando agora', 'Já vendo e preciso organizar', 'Preciso de automações'],
        source: 'guided',
        tool: 'recommend_plan',
        segment,
      }
    }

    return runAssistantTool('recommend_plan', {
      needs: normalizedContext,
      workflow: normalizedContext,
      automationNeeds: normalizedContext,
      stage: normalizedContext,
    })
  }

  if (/estou comecando|ja vendo|preciso de automa|preciso organizar/.test(question)) {
    return runAssistantTool('recommend_plan', {
      needs: normalizedContext,
      workflow: normalizedContext,
      automationNeeds: normalizedContext,
      stage: question,
    })
  }

  if (/demonstracao|ver demo|mostrar demo|me mostra|como fica na pratica/.test(question)) {
    return runAssistantTool('get_demo', { segment })
  }

  if (/quero testar|criar conta|quero assinar|quero contratar|comecar cadastro|fazer cadastro/.test(question)) {
    return runAssistantTool('start_signup', { plan, segment })
  }

  if (/falar com alguem|whatsapp|contato humano|falar com a equipe|quero atendimento/.test(question)) {
    return runAssistantTool('prepare_whatsapp_handoff', { plan, segment })
  }

  if (segment && (/tenho |sou |meu negocio|funciona para|como funciona|trabalho com/.test(question))) {
    return runAssistantTool('get_segment_solution', { segment })
  }

  if (/site proprio|catalogo|cardapio|crm|proposta|financeiro|follow.?up|pedidos/.test(question)) {
    return runAssistantTool('search_features', { query: question })
  }

  if (/mercado pago|cliente precisa criar conta|preciso instalar|funciona no celular/.test(question)) {
    const key = question.includes('mercado pago')
      ? 'pagamentos online'
      : question.includes('cliente')
        ? 'cliente precisa criar uma conta'
        : question.includes('instalar')
          ? 'instalar'
          : 'celular'
    return runAssistantTool('get_faq', { query: key })
  }

  return null
}

export function routeFallbackAssistant(input: {
  question: string
  messages: PublicAssistantMessage[]
}): AssistantResult {
  const known = routeDeterministicAssistant(input)
  if (known) return { ...known, source: 'fallback' }

  return {
    answer:
      'Estou temporariamente sem acesso à conversa por IA, mas ainda consigo te ajudar com informações oficiais do Orçaly. Posso mostrar planos, segmentos, como funciona ou o contato da equipe.',
    suggestions: ['Quanto custa?', 'Ver para meu negócio', 'Como funciona?', 'Falar com a equipe'],
    source: 'fallback',
    tool: null,
    action: {
      label: 'Falar com a equipe',
      href: 'mailto:orcalybr@gmail.com',
      kind: 'secondary',
    },
  }
}
