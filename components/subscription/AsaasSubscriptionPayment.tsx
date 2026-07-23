// ORCALY_ASAAS_MIGRATION_V2
"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type PlanKey = "essencial" | "profissional" | "premium";
type PaymentMethod = "PIX" | "CREDIT_CARD";

const plans: Array<{ key: PlanKey; name: string; price: string }> = [
  { key: "essencial", name: "Essencial", price: "R$ 49,90/mes" },
  { key: "profissional", name: "Profissional", price: "R$ 99,90/mes" },
  { key: "premium", name: "Premium", price: "R$ 149,90/mes" },
];

export default function AsaasSubscriptionPayment() {
  const [planKey, setPlanKey] = useState<PlanKey>("essencial");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    cpfCnpj: "",
    phone: "",
    postalCode: "",
    addressNumber: "",
    addressComplement: "",
  });
  const [card, setCard] = useState({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pix, setPix] = useState<{ encodedImage?: string; payload?: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("Preparando sua assinatura...");
    setPix(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessao nao encontrada.");

      const response = await fetch("/api/assinatura/asaas", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planKey,
          paymentMethod,
          customer,
          card: paymentMethod === "CREDIT_CARD" ? card : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel criar a assinatura.");
      }

      setMessage(payload.message || "Assinatura preparada com sucesso.");
      if (payload.pix) setPix(payload.pix);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel criar a assinatura.");
      setMessage("");
    } finally {
      setLoading(false);
    }
  }

  async function copyPix() {
    if (!pix?.payload) return;
    await navigator.clipboard.writeText(pix.payload);
    setMessage("Codigo Pix copiado.");
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="max-w-3xl">
        <p className="text-sm font-bold text-violet-600">Pagamento seguro Asaas</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Ativar ou reativar assinatura</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          O periodo gratuito continua sendo concedido somente na primeira adesao. Nenhum dado de cartao e armazenado pelo Orcaly.
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-6">
        <fieldset>
          <legend className="text-sm font-bold text-slate-800">Plano</legend>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {plans.map((plan) => (
              <label
                key={plan.key}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  planKey === plan.key
                    ? "border-violet-500 bg-violet-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan.key}
                  checked={planKey === plan.key}
                  onChange={() => setPlanKey(plan.key)}
                  className="sr-only"
                />
                <span className="block font-black text-slate-950">{plan.name}</span>
                <span className="mt-1 block text-sm text-slate-600">{plan.price}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold text-slate-800">Forma de pagamento</legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {(["PIX", "CREDIT_CARD"] as PaymentMethod[]).map((method) => (
              <label key={method} className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold ${
                paymentMethod === method
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-slate-200 text-slate-700"
              }`}>
                <input
                  type="radio"
                  name="method"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                  className="sr-only"
                />
                {method === "PIX" ? "Pix" : "Cartao"}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["name", "Nome", "text"],
            ["email", "E-mail", "email"],
            ["cpfCnpj", "CPF ou CNPJ", "text"],
            ["phone", "Telefone", "tel"],
            ["postalCode", "CEP", "text"],
            ["addressNumber", "Numero", "text"],
            ["addressComplement", "Complemento", "text"],
          ].map(([name, label, type]) => (
            <label key={name} className="text-sm font-semibold text-slate-700">
              <span>{label}</span>
              <input
                type={type}
                value={customer[name as keyof typeof customer]}
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, [name]: event.target.value }))
                }
                required={["name", "email", "cpfCnpj", "postalCode", "addressNumber"].includes(name)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </label>
          ))}
        </div>

        {paymentMethod === "CREDIT_CARD" ? (
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
            {[
              ["holderName", "Nome impresso no cartao", "text", "cc-name"],
              ["number", "Numero do cartao", "text", "cc-number"],
              ["expiryMonth", "Mes", "text", "cc-exp-month"],
              ["expiryYear", "Ano", "text", "cc-exp-year"],
              ["ccv", "CVV", "password", "cc-csc"],
            ].map(([name, label, type, autocomplete]) => (
              <label key={name} className="text-sm font-semibold text-slate-700">
                <span>{label}</span>
                <input
                  type={type}
                  autoComplete={autocomplete}
                  inputMode={name === "holderName" ? "text" : "numeric"}
                  value={card[name as keyof typeof card]}
                  onChange={(event) =>
                    setCard((current) => ({ ...current, [name]: event.target.value }))
                  }
                  required
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>
            ))}
            <p className="md:col-span-2 text-xs leading-5 text-slate-500">
              Os dados sao enviados diretamente ao backend seguro e descartados apos a tokenizacao. O CVV nunca e armazenado.
            </p>
          </div>
        ) : null}

        {error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {message ? <div aria-live="polite" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div> : null}

        {pix ? (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <h3 className="font-black text-slate-950">Pagamento Pix</h3>
            {pix.encodedImage ? (
              <img
                src={`data:image/png;base64,${pix.encodedImage}`}
                alt="QR Code Pix da assinatura"
                className="mt-4 h-48 w-48 rounded-xl bg-white p-2"
              />
            ) : null}
            {pix.payload ? (
              <button
                type="button"
                onClick={copyPix}
                className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-bold text-violet-700 shadow-sm"
              >
                Copiar codigo Pix
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Processando..." : paymentMethod === "PIX" ? "Continuar com Pix" : "Continuar com cartao"}
        </button>
      </form>
    </section>
  );
}
