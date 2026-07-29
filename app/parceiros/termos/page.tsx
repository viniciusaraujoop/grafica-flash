// ORCALY_AFFILIATE_VISUAL_V2
import Link from "next/link";

const summary = [
  ["60%", "do primeiro pagamento elegível"],
  ["7 dias", "período gratuito mínimo"],
  ["14 dias", "retenção de segurança"],
  ["R$ 50,00", "mínimo para solicitar Pix"],
];

type TermSection = {
  id: string;
  title: string;
  body?: string[];
  bullets?: string[];
};

const sections: TermSection[] = [
  {
    id: "objetivo",
    title: "1. Objetivo do programa",
    body: [
      "O Programa Orçaly Parceiros foi criado para permitir que pessoas físicas e jurídicas indiquem novos clientes para o Orçaly e recebam comissão quando essas indicações se transformarem em assinaturas pagas.",
      "O programa não remunera apenas divulgação, clique, cadastro ou teste gratuito. A comissão depende de uma venda elegível, confirmada e vinculada corretamente ao parceiro.",
    ],
  },
  {
    id: "aceite",
    title: "2. Aceite e vigência",
    body: [
      "Ao criar a conta, acessar o portal ou divulgar o link de indicação, o parceiro declara que leu e aceitou estes termos.",
      "A versão aceita no cadastro fica registrada. Se houver mudança relevante nas regras, o Orçaly poderá solicitar um novo aceite antes de liberar novas indicações ou pagamentos.",
    ],
  },
  {
    id: "participacao",
    title: "3. Quem pode participar",
    body: [
      "Podem participar pessoas físicas maiores de 18 anos, profissionais autônomos e pessoas jurídicas com dados válidos e capacidade para receber pagamentos via Pix.",
      "O Orçaly poderá recusar ou suspender cadastros com informações incompletas, divergentes, duplicadas, falsas ou incompatíveis com as verificações de segurança.",
    ],
  },
  {
    id: "relacao",
    title: "4. Natureza da parceria",
    body: [
      "A participação é comercial e independente. Não existe vínculo empregatício, subordinação, jornada obrigatória, salário fixo, exclusividade, representação comercial automática ou obrigação de atingir metas.",
      "O parceiro escolhe quando e como divulgar, respeitando as regras deste documento. Ele não pode assinar contratos, prometer condições, conceder descontos, receber dinheiro de clientes ou falar em nome do Orçaly sem autorização expressa.",
      "Cada participante é responsável pela própria organização, custos, equipamentos, internet, anúncios e demais despesas que decidir assumir.",
    ],
  },
  {
    id: "cadastro",
    title: "5. Cadastro e segurança da conta",
    body: [
      "O parceiro deve informar nome ou razão social, e-mail, WhatsApp, CPF ou CNPJ e uma senha segura. Os dados precisam pertencer ao titular da conta.",
      "A conta é pessoal e não deve ser compartilhada. O parceiro deve avisar o suporte imediatamente se suspeitar de acesso indevido, perda de senha ou uso não autorizado.",
      "O Orçaly poderá solicitar documentos ou informações adicionais para confirmar identidade, titularidade da chave Pix ou legitimidade das indicações.",
    ],
  },
  {
    id: "codigo",
    title: "6. Link, código e atribuição",
    body: [
      "Cada parceiro recebe um código e um link exclusivos. A indicação é registrada quando o futuro cliente acessa o link ou informa o código válido durante o cadastro.",
      "A janela de atribuição é de até 60 dias. O primeiro código válido registrado no processo de cadastro terá preferência, salvo correção administrativa motivada por erro comprovado.",
      "O código não pode ser inserido depois da contratação apenas para gerar comissão. Clientes já existentes, cadastros iniciados antes da indicação e contratos negociados diretamente pelo Orçaly podem ser considerados não elegíveis.",
    ],
  },
  {
    id: "comissao",
    title: "7. Regra da comissão",
    body: [
      "A comissão padrão corresponde a 60% do primeiro pagamento mensal líquido elegível realizado pelo cliente indicado após o período gratuito.",
      "O cálculo usa o valor efetivamente recebido, descontando cupons, descontos, créditos, abatimentos ou outras reduções aplicadas ao cliente.",
      "A base de cálculo nunca ultrapassa o preço mensal oficial do plano. Em contratos anuais, antecipados ou com vários meses pagos de uma vez, a comissão continua limitada ao equivalente a uma mensalidade elegível.",
      "O percentual exibido no portal no momento da conversão será registrado junto da comissão. Campanhas especiais poderão ter regras próprias, desde que informadas antes da participação.",
    ],
  },
  {
    id: "nao-elegivel",
    title: "8. Situações que não geram comissão",
    bullets: [
      "Cadastro, clique ou teste gratuito sem pagamento posterior.",
      "Pagamento recusado, pendente, cancelado, estornado, contestado ou identificado como fraude.",
      "Autoindicação ou indicação de empresa ligada ao próprio parceiro.",
      "Cliente que já possuía conta, negociação, proposta ou relacionamento comercial ativo com o Orçaly.",
      "Cadastros duplicados, artificiais, incompletos ou feitos apenas para testar o sistema.",
      "Pagamento feito antes do período mínimo de 7 dias, quando a operação não representar a primeira renovação elegível.",
      "Venda realizada com violação destes termos ou por meio de informação enganosa.",
    ],
  },
  {
    id: "retencao",
    title: "9. Retenção e liberação do saldo",
    body: [
      "Depois que o pagamento elegível for confirmado, a comissão entra em retenção por 14 dias.",
      "Durante esse período, o valor aparece no portal, mas ainda não pode ser solicitado. A retenção existe para cobrir cancelamentos, duplicidades, estornos, chargebacks e verificações de segurança.",
      "Encerrado o prazo sem ocorrência impeditiva, a comissão muda para disponível. A liberação automática não significa renúncia ao direito de correção caso uma fraude ou estorno seja confirmado posteriormente.",
    ],
  },
  {
    id: "pix",
    title: "10. Conta Pix e solicitação de pagamento",
    body: [
      "O parceiro deve cadastrar uma chave Pix de sua titularidade. O CPF ou CNPJ do titular precisa ser o mesmo informado no cadastro.",
      "O pagamento pode depender de verificação automática ou manual. Chaves divergentes, contas de terceiros ou dados bancários inconsistentes poderão ser recusados.",
      "O valor mínimo para solicitar pagamento é de R$ 50,00 em saldo disponível. O portal poderá reunir várias comissões em uma única solicitação.",
      "A solicitação ficará sujeita a aprovação administrativa. O pagamento poderá ser realizado de forma manual ou por integração financeira, mantendo o registro do lote, valor, data e referência da transferência.",
    ],
  },
  {
    id: "estorno",
    title: "11. Estornos, cancelamentos e saldo devedor",
    body: [
      "Se o pagamento do cliente for estornado, contestado, cancelado ou considerado fraudulento, a comissão correspondente será revertida.",
      "Quando a comissão ainda estiver em retenção ou disponível, o valor será removido do saldo. Se já tiver sido pago ao parceiro, o sistema poderá registrar saldo devedor para compensação em comissões futuras.",
      "O parceiro poderá solicitar revisão, mas a simples contestação não impede a aplicação temporária da medida de segurança.",
    ],
  },
  {
    id: "divulgacao",
    title: "12. Regras de divulgação",
    body: [
      "O parceiro pode divulgar seu link em redes sociais, WhatsApp, sites, comunidades e contatos comerciais, desde que a abordagem seja respeitosa e verdadeira.",
      "Toda comunicação deve deixar claro que se trata de uma indicação independente. O parceiro não é funcionário, sócio, representante legal ou suporte oficial do Orçaly.",
    ],
    bullets: [
      "Não enviar spam ou mensagens em massa sem contexto e consentimento.",
      "Não prometer renda garantida, lucro certo ou comissão antes do pagamento elegível.",
      "Não oferecer desconto, prazo, funcionalidade ou condição que não exista oficialmente.",
      "Não criar páginas, perfis ou domínios que possam ser confundidos com canais oficiais.",
      "Não usar anúncios com informação falsa, comparação manipulada ou ataque a concorrentes.",
      "Não coletar senha, cartão, documento ou pagamento em nome do Orçaly.",
    ],
  },
  {
    id: "marca",
    title: "13. Uso da marca e dos materiais",
    body: [
      "O parceiro pode usar materiais de divulgação disponibilizados pelo Orçaly enquanto participar do programa.",
      "A marca, logotipo, textos, telas e materiais continuam pertencendo ao Orçaly. Alterações que prejudiquem a identidade, removam avisos ou criem falsa aparência de canal oficial não são permitidas.",
      "O direito de uso termina quando a conta for encerrada, suspensa ou quando o Orçaly solicitar a retirada de uma peça específica.",
    ],
  },
  {
    id: "dados",
    title: "14. Privacidade, dados e confidencialidade",
    body: [
      "O portal mostra apenas as informações necessárias para acompanhar a indicação. Dados de clientes podem aparecer mascarados.",
      "O parceiro não pode tentar descobrir, exportar, compartilhar ou usar dados de clientes para finalidade diferente da indicação.",
      "Informações internas, critérios antifraude, relatórios, saldos, campanhas não públicas e dados recebidos pelo suporte devem ser tratados com confidencialidade.",
      "O Orçaly poderá registrar acessos, eventos, identificadores técnicos e histórico de alterações para segurança, prevenção de fraude, suporte e auditoria.",
    ],
  },
  {
    id: "tributos",
    title: "15. Tributos e documentação",
    body: [
      "Cada parceiro é responsável por verificar suas obrigações fiscais, contábeis e cadastrais relacionadas aos valores recebidos.",
      "O Orçaly poderá solicitar nota fiscal, recibo, comprovante ou outra documentação necessária para realizar ou justificar pagamentos, conforme o perfil do parceiro e as exigências aplicáveis.",
      "A ausência de documentação solicitada poderá suspender o pagamento até a regularização.",
    ],
  },
  {
    id: "ranking",
    title: "16. Ranking, campanhas e benefícios",
    body: [
      "O ranking pode considerar clientes pagos, plano contratado, permanência, estornos e outros critérios divulgados no portal.",
      "A posição não representa promessa de prêmio. Campanhas, bônus, níveis e benefícios adicionais terão regras, datas e condições próprias.",
      "O Orçaly poderá corrigir pontuações quando encontrar duplicidade, estorno, fraude ou erro técnico.",
    ],
  },
  {
    id: "suspensao",
    title: "17. Suspensão e encerramento",
    body: [
      "O Orçaly poderá suspender preventivamente a conta e o saldo quando houver indício de fraude, autoindicação, violação de marca, spam, dados falsos ou risco financeiro.",
      "Em caso de violação confirmada, a conta poderá ser encerrada, as comissões não elegíveis poderão ser canceladas e os valores já pagos indevidamente poderão ser compensados ou cobrados.",
      "O parceiro pode pedir o encerramento da conta pelo suporte. Comissões legítimas e já disponíveis seguirão o fluxo de pagamento, descontados ajustes, dívidas ou obrigações pendentes.",
    ],
  },
  {
    id: "auditoria",
    title: "18. Auditoria e contestação",
    body: [
      "O Orçaly mantém registros de cliques, cadastros, pagamentos, webhooks, alterações administrativas e solicitações de Pix.",
      "O parceiro pode contestar uma decisão pelo suporte, informando o código, a indicação ou o pagamento relacionado. A análise poderá exigir documentos e terá como base os registros técnicos e financeiros disponíveis.",
    ],
  },
  {
    id: "disponibilidade",
    title: "19. Disponibilidade do portal",
    body: [
      "O Orçaly procura manter o portal disponível e atualizado, mas poderá realizar manutenção, correção ou suspensão temporária.",
      "Falhas de internet, serviços bancários, provedores de pagamento ou plataformas de terceiros podem atrasar atualização de status e transferências. O histórico será conciliado assim que os serviços forem normalizados.",
    ],
  },
  {
    id: "alteracoes",
    title: "20. Alterações nas regras",
    body: [
      "O programa pode ser ajustado para acompanhar custos, fraudes, mudanças operacionais, condições de mercado ou exigências legais.",
      "Mudanças relevantes serão comunicadas pelo portal, e-mail ou WhatsApp cadastrado. Comissões já registradas manterão, em regra, o percentual e as condições gravadas no momento da elegibilidade, salvo correção de erro ou fraude.",
    ],
  },
  {
    id: "suporte",
    title: "21. Suporte e solução de problemas",
    body: [
      "Dúvidas, pedidos de revisão e comunicações sobre segurança devem ser enviados para orcalybr@gmail.com ou pelos canais exibidos no portal.",
      "As partes buscarão resolver divergências de forma direta e documentada. Se isso não for possível, serão observadas as regras legais de competência aplicáveis ao caso.",
    ],
  },
];

export default function ParceirosTermosPage() {
  return (
    <main
      data-partner-portal
      className="min-h-screen bg-[#edf3f9] px-3 py-5 text-[#071b3a] sm:px-6 sm:py-8"
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="partner-drift absolute -right-40 -top-48 h-[480px] w-[480px] rounded-full bg-blue-200/55 blur-3xl" />
        <div className="absolute -bottom-40 -left-36 h-[420px] w-[420px] rounded-full bg-emerald-100/60 blur-3xl" />
      </div>

      <article className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.3rem] border border-white bg-white shadow-[0_35px_100px_rgba(6,26,54,.12)]">
        <header className="relative overflow-hidden bg-[#04152f] p-6 text-white sm:p-9">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 left-[25%] h-64 w-64 rounded-full bg-emerald-400/14 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
                Versão de 29 de julho de 2026
              </p>
              <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.065em] sm:text-5xl lg:text-6xl">
                Termos de Uso e Participação no Programa Orçaly Parceiros
              </h1>
              <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-white/58">
                Este documento explica como a indicação é atribuída, quando a comissão nasce, como o Pix é liberado e quais práticas protegem o parceiro, o cliente e o Orçaly.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/parceiros"
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                Voltar ao portal
              </Link>
              <Link
                href="/parceiros/cadastro"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c]"
              >
                Criar conta
              </Link>
            </div>
          </div>

          <div className="relative mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summary.map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
              >
                <p className="text-2xl font-black">{value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/38">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid lg:grid-cols-[250px_1fr]">
          <aside className="border-b border-slate-200 bg-[#f7f9fc] p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
              Navegação
            </p>
            <nav className="mt-4 grid gap-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-xl px-3 py-2 text-xs font-bold leading-5 text-slate-500 transition hover:bg-white hover:text-[#05245c]"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 p-4 sm:p-7 lg:p-9">
            <section className="partner-fade-up rounded-[1.6rem] border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                Resumo em linguagem direta
              </p>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                Você indica. O cliente testa por pelo menos 7 dias. Se ele fizer o primeiro pagamento mensal elegível, sua comissão de 60% entra em retenção. Depois de 14 dias, sem estorno ou irregularidade, o valor fica disponível. Com R$ 50 ou mais e a conta Pix verificada, você pode solicitar o pagamento.
              </p>
            </section>

            <div className="mt-6 grid gap-4">
              {sections.map((section, index) => (
                <section
                  id={section.id}
                  key={section.id}
                  data-partner-card
                  className="partner-fade-up scroll-mt-6 rounded-[1.6rem] border border-slate-200 bg-white p-5 sm:p-6"
                  style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
                >
                  <h2 className="text-xl font-black tracking-[-0.035em] sm:text-2xl">
                    {section.title}
                  </h2>

                  {section.body?.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-3 text-sm font-semibold leading-7 text-slate-600"
                    >
                      {paragraph}
                    </p>
                  ))}

                  {section.bullets ? (
                    <ul className="mt-4 grid gap-2">
                      {section.bullets.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 rounded-xl bg-[#f7f9fc] p-3 text-sm font-semibold leading-6 text-slate-600"
                        >
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#05245c] text-[10px] font-black text-white">
                            ✓
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <section className="mt-6 rounded-[1.7rem] bg-[#071b3a] p-6 text-white sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-200/65">
                Declaração de aceite
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                O cadastro confirma que você entendeu as regras.
              </h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-white/60">
                Ao marcar a caixa de aceite, você confirma que os dados informados são verdadeiros, que a conta Pix será de sua titularidade e que sua divulgação seguirá estas condições.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/parceiros/cadastro"
                  className="rounded-2xl bg-white px-5 py-4 text-center text-sm font-black text-[#05245c]"
                >
                  Aceitar e criar conta
                </Link>
                <a
                  href="mailto:orcalybr@gmail.com?subject=Dúvida%20sobre%20os%20Termos%20do%20Programa%20de%20Parceiros"
                  className="rounded-2xl border border-white/15 px-5 py-4 text-center text-sm font-black text-white"
                >
                  Tirar uma dúvida
                </a>
              </div>
            </section>

            <p className="mt-6 text-center text-xs font-semibold leading-5 text-slate-400">
              Este regulamento é a base operacional do programa. Questões fiscais, contábeis ou jurídicas específicas devem ser avaliadas conforme a situação do parceiro.
            </p>
          </div>
        </div>
      </article>
    </main>
  );
}
