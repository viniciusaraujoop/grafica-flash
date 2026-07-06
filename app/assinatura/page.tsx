"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PlanoId = "basico" | "profissional" | "premium";
type PaymentMode = "pix_avulso" | "cartao_recorrente";

type Plano = {
  id: PlanoId;
  nome: string;
  preco: number;
  descricao: string;
};

const planos: Plano[] = [
  {
    id: "basico",
    nome: "Básico",
    preco: 49.9,
    descricao:
      "Catálogo, página pública, formulário de orçamento e painel de pedidos.",
  },
  {
    id: "profissional",
    nome: "Profissional",
    preco: 99.9,
    descricao:
      "Catálogo completo, propostas profissionais, status e relatórios.",
  },
  {
    id: "premium",
    nome: "Premium",
    preco: 149.9,
    descricao: "Automações, recuperação de orçamento e recursos inteligentes.",
  },
];

type Empresa = {
  id: string;
  nome?: string | null;
  email?: string | null;
  plano?: string | null;
  assinatura_plano?: string | null;
  assinatura_status?: string | null;
  assinatura_expira_em?: string | null;
};

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizarPlano(value: unknown): PlanoId {
  if (value === "basico" || value === "profissional" || value === "premium")
    return value;
  return "profissional";
}

function getMensagemErro(payload: any) {
  if (!payload) return "Erro desconhecido.";
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.details?.message === "string")
    return payload.details.message;
  return "Não foi possível gerar o checkout.";
}

export default function AssinaturaPage() {
  const router = useRouter();

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [emailUsuario, setEmailUsuario] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [planoSelecionado, setPlanoSelecionado] =
    useState<PlanoId>("profissional");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("pix_avulso");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const planoAtual =
    planos.find((plano) => plano.id === planoSelecionado) || planos[1];

  async function carregarEmpresa() {
    setCarregando(true);
    setErro("");
    setMensagem("");

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session?.access_token || !session.user) {
      router.push("/login");
      return;
    }

    setAccessToken(session.access_token);
    setEmailUsuario(session.user.email || "");

    try {
      const response = await fetch("/api/company/current", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao carregar empresa atual.");
      }

      if (!payload.company?.id) {
        throw new Error("Empresa não encontrada para esta conta.");
      }

      setEmpresa(payload.company);
      setPlanoSelecionado(
        normalizarPlano(
          payload.company.assinatura_plano || payload.company.plano,
        ),
      );
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Erro ao carregar empresa.",
      );
    }

    setCarregando(false);
  }

  async function renovarOuAlterarPlano() {
    if (processando) return;

    setErro("");
    setMensagem("");

    if (!empresa?.id) {
      setErro("Empresa não carregada. Atualize a página e tente novamente.");
      return;
    }

    if (!accessToken) {
      setErro("Sessão não encontrada. Faça login novamente.");
      return;
    }

    setProcessando(true);
    setMensagem(
      paymentMode === "pix_avulso"
        ? "Gerando pagamento Pix avulso pelo Mercado Pago..."
        : "Gerando assinatura automática no cartão pelo Mercado Pago...",
    );

    try {
      const endpoint =
        paymentMode === "cartao_recorrente"
          ? "/api/company/subscription"
          : "/api/checkout/plano";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          plano: planoSelecionado,
          companyId: empresa.id,
          email: empresa.email || emailUsuario,
          nomeEmpresa: empresa.nome || "Empresa",
          origem: "assinatura_page",
          payment_mode: paymentMode,
          paymentMode,
          metodoPagamento: paymentMode,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getMensagemErro(payload));
      }

      const checkoutUrl =
        payload.checkout_url ||
        payload.checkoutUrl ||
        payload.init_point ||
        payload.sandbox_init_point ||
        payload.url;

      if (!checkoutUrl) {
        throw new Error(
          "Checkout criado sem link de pagamento. Verifique a resposta do Mercado Pago.",
        );
      }

      setMensagem(
        paymentMode === "pix_avulso"
          ? "Pix gerado. Redirecionando para pagamento..."
          : "Assinatura criada. Redirecionando para o cartão recorrente...",
      );
      window.location.href = checkoutUrl;
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Erro ao gerar pagamento.",
      );
      setMensagem("");
      setProcessando(false);
    }
  }

  useEffect(() => {
    carregarEmpresa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#151816] px-4 py-8 text-[#f0e7d8]">
        <section className="mx-auto max-w-4xl rounded-[2rem] border border-blue-900/70 bg-[#181b1a] p-8">
          <p className="font-black">Carregando assinatura...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#151816] px-4 py-8 text-[#f0e7d8]">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-blue-900/70 bg-[#181b1a] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f0e7d8]">
          Planos
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[#f0e7d8]">
          Selecione o plano da empresa
        </h1>

        {empresa?.nome && (
          <p className="mt-3 text-sm font-bold text-[#d4c8b7]">
            Empresa: {empresa.nome}
          </p>
        )}

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-700 bg-blue-950/40 p-4 text-sm font-black text-blue-100">
            {mensagem}
          </div>
        )}

        {erro && (
          <div className="mt-5 rounded-2xl border border-red-700 bg-red-950/40 p-4 text-sm font-black leading-6 text-red-100">
            {erro}
          </div>
        )}

        <div className="mt-7 grid gap-4">
          {planos.map((plano) => {
            const selected = planoSelecionado === plano.id;

            return (
              <button
                key={plano.id}
                type="button"
                onClick={() => setPlanoSelecionado(plano.id)}
                disabled={processando}
                className={`rounded-2xl border p-5 text-left transition ${
                  selected
                    ? "border-blue-700 bg-[#171f22]"
                    : "border-[#746f67] bg-transparent hover:border-blue-700"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xl font-black text-[#f0e7d8]">
                      {plano.nome}
                    </p>
                    <p className="mt-2 text-sm font-black leading-6 text-[#d4c8b7]">
                      {plano.descricao}
                    </p>
                  </div>

                  <p className="shrink-0 text-2xl font-black text-[#f0e7d8]">
                    {formatMoney(plano.preco)}/mês
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-7 rounded-2xl border border-blue-900/70 bg-[#111514] p-5">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-[#d4c8b7]">
            Forma de pagamento
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentMode("pix_avulso")}
              disabled={processando}
              className={`rounded-2xl border p-5 text-left transition ${
                paymentMode === "pix_avulso"
                  ? "border-emerald-500 bg-emerald-950/30"
                  : "border-[#746f67] bg-transparent hover:border-emerald-600"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <p className="text-lg font-black text-[#f0e7d8]">
                Pix mensal avulso
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[#d4c8b7]">
                O cliente paga o mês por Pix. Após confirmação do Mercado Pago,
                o plano é ativado/renovado por 30 dias.
              </p>
              <p className="mt-3 rounded-full bg-emerald-950/60 px-3 py-2 text-xs font-black text-emerald-100">
                Sem renovação automática
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode("cartao_recorrente")}
              disabled={processando}
              className={`rounded-2xl border p-5 text-left transition ${
                paymentMode === "cartao_recorrente"
                  ? "border-blue-600 bg-blue-950/30"
                  : "border-[#746f67] bg-transparent hover:border-blue-700"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <p className="text-lg font-black text-[#f0e7d8]">
                Cartão recorrente
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[#d4c8b7]">
                Cria uma assinatura automática pelo Mercado Pago. Ideal para
                quem quer não lembrar de pagar todo mês, luxo raríssimo.
              </p>
              <p className="mt-3 rounded-full bg-blue-950/60 px-3 py-2 text-xs font-black text-blue-100">
                Renovação automática
              </p>
            </button>
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-blue-800 bg-[#171f22] p-6">
          <p className="text-sm font-black text-[#d4c8b7]">Plano selecionado</p>
          <h2 className="mt-2 text-3xl font-black text-[#f0e7d8]">
            {planoAtual.nome}
          </h2>
          <p className="mt-2 text-4xl font-black text-[#f0e7d8]">
            {formatMoney(planoAtual.preco)}/mês
          </p>
          <p className="mt-4 text-sm font-black leading-7 text-[#d4c8b7]">
            {paymentMode === "pix_avulso"
              ? "Pagamento avulso por Pix. Após aprovação, o webhook renova a empresa por mais 30 dias."
              : "Pagamento recorrente no cartão. Após autorização, o Mercado Pago cobra automaticamente os próximos ciclos."}
          </p>
        </div>

        <button
          type="button"
          onClick={renovarOuAlterarPlano}
          disabled={processando || !empresa?.id}
          className="mt-7 w-full rounded-2xl bg-[#062766] px-6 py-5 text-center font-black text-white transition hover:bg-[#07317f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processando
            ? "Gerando pagamento..."
            : paymentMode === "pix_avulso"
              ? "Pagar mês avulso com Pix"
              : "Ativar cartão recorrente"}
        </button>

        <button
          type="button"
          onClick={carregarEmpresa}
          disabled={processando}
          className="mt-3 w-full rounded-2xl border border-blue-900/70 px-6 py-4 text-center text-sm font-black text-[#f0e7d8] transition hover:bg-blue-950/20 disabled:opacity-60"
        >
          Recarregar dados da assinatura
        </button>
      </section>
    </main>
  );
}
