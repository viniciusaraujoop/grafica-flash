"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  supabase,
} from "@/lib/supabase";

type AccountState = {
  configured?: boolean;
  accountStatus?: string | null;
  onboardingStatus?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  pixEnabled?: boolean;
  onboardingUrl?: string | null;
  legalName?: string | null;
  documentLast4?: string | null;
  capabilities?: {
    environment?: string;
    subaccountsEnabled?: boolean;
  };
  suggested?: {
    name?: string;
    email?: string;
    mobilePhone?: string;
  };
};

type FormState = {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate: string;
  companyType: string;
  phone: string;
  mobilePhone: string;
  incomeValue: string;
  address: string;
  addressNumber: string;
  complement: string;
  province: string;
  postalCode: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  cpfCnpj: "",
  birthDate: "",
  companyType: "MEI",
  phone: "",
  mobilePhone: "",
  incomeValue: "",
  address: "",
  addressNumber: "",
  complement: "",
  province: "",
  postalCode: "",
};

function onlyDigits(
  value: string,
) {
  return value.replace(
    /\D/g,
    "",
  );
}

export default function AsaasMarketplaceSetup() {
  const [
    account,
    setAccount,
  ] =
    useState<AccountState | null>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      initialForm,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const authToken = useCallback(async () => {
    const {
      data,
    } =
      await supabase.auth
        .getSession();

    const token =
      data.session
        ?.access_token ||
      "";

    if (!token) {
      throw new Error(
        "VocÃª precisa estar logado.",
      );
    }

    return token;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token =
        await authToken();

      const response =
        await fetch(
          "/api/payments/asaas/account",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache:
              "no-store",
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "NÃ£o foi possÃ­vel consultar o Asaas.",
        );
      }

      setAccount(payload);

      setForm(
        (current) => ({
          ...current,
          name:
            current.name ||
            payload.suggested
              ?.name ||
            "",
          email:
            current.email ||
            payload.suggested
              ?.email ||
            "",
          mobilePhone:
            current.mobilePhone ||
            payload.suggested
              ?.mobilePhone ||
            "",
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao carregar.",
      );
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  function update(
    key: keyof FormState,
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const token =
        await authToken();

      const response =
        await fetch(
          "/api/payments/asaas/account",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                ...form,
                incomeValue:
                  Number(
                    form.incomeValue,
                  ),
              }),
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "NÃ£o foi possÃ­vel criar a subconta.",
        );
      }

      setMessage(
        payload.repeated
          ? "A subconta Asaas jÃ¡ estava cadastrada."
          : "Subconta Asaas criada e credencial armazenada com seguranÃ§a.",
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao criar a subconta.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshStatus() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const token =
        await authToken();

      const response =
        await fetch(
          "/api/payments/asaas/account/status",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "NÃ£o foi possÃ­vel atualizar a situaÃ§Ã£o.",
        );
      }

      setMessage(
        `SituaÃ§Ã£o atualizada: ${payload.account?.status || "PENDING"}.`,
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao atualizar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const document =
    onlyDigits(
      form.cpfCnpj,
    );

  const isCompany =
    document.length > 11;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 font-bold shadow-sm">
          Carregando configuraÃ§Ã£o Asaas...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
            Marketplace Â· Sandbox
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Conta Asaas da empresa
          </h1>

          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">
            Esta etapa cria uma subconta Asaas separada para a empresa emitir cobranÃ§as do marketplace. O Mercado Pago continua ativo durante os testes.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/painel/pagamentos"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700"
            >
              Voltar aos pagamentos
            </Link>

            <span className="rounded-xl bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">
              Ambiente: {account?.capabilities?.environment || "sandbox"}
            </span>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {account?.configured ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase text-slate-400">
                  Titular
                </p>
                <p className="mt-1 font-black text-slate-950">
                  {account.legalName || "Subconta Asaas"}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase text-slate-400">
                  Documento
                </p>
                <p className="mt-1 font-black text-slate-950">
                  Final {account.documentLast4 || "----"}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase text-slate-400">
                  SituaÃ§Ã£o Asaas
                </p>
                <p className="mt-1 font-black text-slate-950">
                  {account.accountStatus || "PENDING"}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase text-slate-400">
                  Pix
                </p>
                <p className="mt-1 font-black text-slate-950">
                  {account.chargesEnabled && account.pixEnabled
                    ? "Liberado"
                    : "Aguardando liberaÃ§Ã£o"}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void refreshStatus()}
              className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {submitting
                ? "Consultando..."
                : "Atualizar situaÃ§Ã£o"}
            </button>
          </section>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <h2 className="text-xl font-black text-slate-950">
              Dados cadastrais
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use dados reais apenas em produÃ§Ã£o. Neste Preview estamos usando o Sandbox do Asaas.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Nome / razÃ£o social</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>E-mail</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>CPF ou CNPJ</span>
                <input
                  required
                  value={form.cpfCnpj}
                  onChange={(event) => update("cpfCnpj", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              {isCompany ? (
                <label className="space-y-1 text-sm font-bold text-slate-700">
                  <span>Tipo de empresa</span>
                  <select
                    required
                    value={form.companyType}
                    onChange={(event) => update("companyType", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                  >
                    <option value="MEI">MEI</option>
                    <option value="LIMITED">Limitada</option>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="ASSOCIATION">AssociaÃ§Ã£o</option>
                  </select>
                </label>
              ) : (
                <label className="space-y-1 text-sm font-bold text-slate-700">
                  <span>Data de nascimento</span>
                  <input
                    type="date"
                    required
                    value={form.birthDate}
                    onChange={(event) => update("birthDate", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                  />
                </label>
              )}

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Celular</span>
                <input
                  required
                  value={form.mobilePhone}
                  onChange={(event) => update("mobilePhone", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Telefone fixo (opcional)</span>
                <input
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Faturamento / renda mensal</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={form.incomeValue}
                  onChange={(event) => update("incomeValue", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>CEP</span>
                <input
                  required
                  value={form.postalCode}
                  onChange={(event) => update("postalCode", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700 sm:col-span-2">
                <span>Logradouro</span>
                <input
                  required
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>NÃºmero</span>
                <input
                  required
                  value={form.addressNumber}
                  onChange={(event) => update("addressNumber", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Bairro</span>
                <input
                  required
                  value={form.province}
                  onChange={(event) => update("province", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700 sm:col-span-2">
                <span>Complemento (opcional)</span>
                <input
                  value={form.complement}
                  onChange={(event) => update("complement", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {submitting
                ? "Criando subconta..."
                : "Criar subconta Sandbox"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}