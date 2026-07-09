import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value || "";
}

function getReturnCopy(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "approved" || normalized === "authorized" || normalized === "success") {
    return {
      title: "Assinatura em processamento",
      description:
        "Recebemos o retorno do Mercado Pago. Assim que a confirmação chegar pelo webhook, sua assinatura será atualizada automaticamente no painel.",
      badge: "Pagamento enviado",
    };
  }

  if (normalized === "pending" || normalized === "in_process") {
    return {
      title: "Pagamento pendente",
      description:
        "O Mercado Pago ainda está processando a cobrança. Se for Pix, a liberação acontece após a confirmação do pagamento.",
      badge: "Pendente",
    };
  }

  if (normalized === "failure" || normalized === "rejected" || normalized === "cancelled") {
    return {
      title: "Pagamento não concluído",
      description:
        "A cobrança não foi finalizada. Você pode voltar para a tela de assinatura e tentar novamente com Pix mensal avulso ou cartão recorrente.",
      badge: "Não concluído",
    };
  }

  return {
    title: "Retorno da assinatura",
    description:
      "Você voltou do Mercado Pago. O status definitivo será sincronizado automaticamente quando o Mercado Pago enviar a confirmação.",
    badge: "Retorno recebido",
  };
}

export default async function AssinaturaRetornoPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const status = getParam(params, "status") || getParam(params, "collection_status");
  const copy = getReturnCopy(status);

  return (
    <main className="min-h-screen bg-[#151816] px-4 py-10 text-[#f0e7d8]">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-blue-900/70 bg-[#181b1a] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <span className="inline-flex rounded-full border border-blue-200/20 bg-blue-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-blue-100">
          {copy.badge}
        </span>

        <h1 className="mt-6 text-3xl font-black text-white sm:text-4xl">
          {copy.title}
        </h1>

        <p className="mt-4 text-base font-semibold leading-7 text-[#d7cdbc]">
          {copy.description}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/assinatura"
            className="rounded-2xl bg-blue-600 px-5 py-3 text-center font-black text-white transition hover:bg-blue-500"
          >
            Voltar para assinatura
          </Link>
          <Link
            href="/painel"
            className="rounded-2xl border border-blue-100/20 bg-white/5 px-5 py-3 text-center font-black text-[#f0e7d8] transition hover:bg-white/10"
          >
            Ir para o painel
          </Link>
        </div>
      </section>
    </main>
  );
}
