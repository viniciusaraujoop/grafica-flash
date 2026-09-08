import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const includesAll = (source, values, label) => values.forEach((value) => assert(source.includes(value), `${label} missing: ${value}`))

const page = read('app/page.tsx')
const main = read('components/marketing/MainSiteV2.tsx')
const demo = read('components/marketing/ProductDemoTabs.tsx')
const selector = read('components/marketing/PlanSelector.tsx')
const assistant = read('components/home/HomeAiChat.tsx')
const marketing = read('lib/marketing/main-site.ts')
const motion = read('components/marketing/MainSiteMotion.tsx')
const visualCss = read('app/MainSitePremium.module.css')
const assistantCss = read('app/MainSiteAssistantPremium.module.css')

assert(!page.includes("'use client'") && !page.includes('"use client"'), 'Home page must remain server-rendered by default')
includesAll(page, [
  "title: 'Orçaly — Site, pedidos, clientes e operação no mesmo fluxo'",
  "'Crie a presença digital da sua empresa, receba vendas e orçamentos e acompanhe pedidos, clientes, propostas e operação em um painel adaptado ao seu negócio.'",
  "title: 'Orçaly — O sistema que entende como sua empresa trabalha'",
  "description: 'Do primeiro contato à entrega, tudo no mesmo fluxo.'",
  "'@type': 'SoftwareApplication'",
  "priceCurrency: 'BRL'",
  "replace(/</g",
], 'SEO/structured-data contract')

includesAll(main, [
  'O sistema que entende como sua empresa trabalha.',
  'Seu site, pedidos, clientes e operação. Tudo trabalhando junto.',
  'Crie a presença digital da sua empresa, receba vendas e orçamentos e acompanhe toda a operação em um único painel adaptado ao seu segmento.',
  'Criar minha conta',
  'Ver o Orçaly funcionando',
  'Seu próprio site',
  'Painel adaptado',
  'Pedidos e clientes centralizados',
  'Pagamentos online via Mercado Pago quando configurados no marketplace.',
  'O cliente entra. O Orçaly organiza. Sua equipe executa.',
  'O painel muda porque a operação muda.',
  'Menos lista de features. Mais clareza sobre o que muda na rotina.',
  'Seu negócio merece um endereço que trabalha junto com a operação.',
  'Continue usando o WhatsApp. Só pare de usar ele como sistema de gestão.',
  'Escolha pelo momento da empresa, não por uma tabela interminável.',
  'Da escolha do negócio ao primeiro cliente, sem montar cinco ferramentas.',
  'A confiança vem do produto e dos limites claros.',
  'Antes de criar sua conta.',
  'Quer entender como o Orçaly encaixa na sua empresa?',
  'Pronto para começar?',
  'Organize sua empresa sem transformar sua rotina em outro trabalho.',
  'Site, clientes, vendas e operação no mesmo fluxo, adaptado ao tipo de empresa.',
  'Pagamentos online do marketplace via Mercado Pago quando configurados.',
], 'Homepage copy lock')

includesAll(main, [
  'href="#produto"',
  'href="#segmentos"',
  'href="#planos"',
  'href="#recursos"',
  'href="#contato"',
  'href="/login"',
  'href="/cadastro"',
  'href="/parceiros"',
  'href="/suporte"',
  'mailto:orcalybr@gmail.com',
  'marketingPlanSignupHref(plan.id)',
], 'Homepage navigation/CTA lock')

includesAll(marketing, [
  "name: 'Básico'",
  'price: 49.9',
  "name: 'Intermediário'",
  'price: 99.9',
  "name: 'Premium'",
  'price: 149.9',
  "question: 'O que é o Orçaly?'",
  "question: 'Preciso instalar alguma coisa?'",
  "question: 'Minha empresa ganha um site próprio?'",
  "question: 'O Orçaly funciona no celular?'",
  "question: 'Como funcionam os pagamentos online?'",
  "question: 'Meu cliente precisa criar uma conta?'",
  "question: 'Funciona para meu segmento?'",
], 'Canonical pricing/FAQ lock')

includesAll(demo, [
  'role="tablist"',
  'aria-selected={active.slug === solution.slug}',
  'Ver solução para {active.shortLabel.toLowerCase()}',
  'Hoje no Orçaly',
  'O que precisa da sua atenção',
  'Fluxo operacional',
  'Próxima ação claramente visível',
  'suaempresa.orcaly.com.br',
], 'Product demo lock')

includesAll(selector, [
  'aria-pressed={active}',
  'Qual plano combina com você?',
  'Marque o que sua empresa precisa agora.',
  'Quero propostas, follow-up e mais controle comercial.',
  'Quero automações para reduzir tarefas repetitivas.',
  'Quero recursos avançados para uma operação em crescimento.',
  'Recomendação pelas respostas',
  'Criar conta com {recommended.name}',
  'Limpar respostas',
  'marketingPlanSignupHref(recommended.id)',
], 'Plan selector lock')

includesAll(assistant, [
  "const STORAGE_KEY = 'orcaly:home-ai-chat:v2'",
  "fetch('/api/public/home-chat'",
  'Descobrir meu plano ideal',
  'Comparar os três planos',
  'Quais segmentos são atendidos?',
  'Como funciona o site próprio?',
  'Assistente Orçaly',
  'Não compartilhe senhas, cartões, CPF ou dados financeiros.',
  'mailto:orcalybr@gmail.com',
], 'Assistant contract lock')

assert(page.includes('MainSitePremium.module.css') && page.includes('MainSiteAssistantPremium.module.css'), 'Premium visual shell missing')
assert(page.includes('<MainSiteMotion />') && page.includes('<MainSiteV2 />'), 'Visual shell must preserve MainSiteV2 and motion island')
assert(motion.includes('IntersectionObserver') && motion.includes("header.dataset.scrolled"), 'Motion island missing reveal/header behavior')
assert(visualCss.includes('prefers-reduced-motion') && assistantCss.includes('prefers-reduced-motion'), 'Reduced-motion coverage missing')
assert(!motion.includes('setTimeout(') && !motion.includes('location.reload') && !motion.includes('window.location.reload'), 'Motion implementation contains forbidden workaround')

console.log('Main site premium visual content/function lock: PASS')
