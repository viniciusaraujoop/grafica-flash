"use client";

// ORCALY_AFFILIATE_VISUAL_V2

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type FormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  whatsapp: string;
  document: string;
  termsAccepted: boolean;
  marketingOptIn: boolean;
};

const initialForm: FormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  whatsapp: "",
  document: "",
  termsAccepted: false,
  marketingOptIn: false,
};

function formatPhone(value: string) {
  const clean = value.replace(/\D/g, "").slice(0, 13);

  if (clean.length <= 2) return clean;
  if (clean.length <= 7) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  }
  if (clean.length <= 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }

  return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9, 13)}`;
}

function formatDocument(value: string) {
  const clean = value.replace(/\D/g, "").slice(0, 14);

  if (clean.length <= 11) {
    return clean
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return clean
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function passwordStrength(value: string) {
  let score = 0;

  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) {
    return {
      label: "Fraca",
      width: "20%",
      tone: "bg-red-400",
    };
  }

  if (score <= 3) {
    return {
      label: "Boa",
      width: "60%",
      tone: "bg-amber-400",
    };
  }

  return {
    label: "Forte",
    width: "100%",
    tone: "bg-emerald-400",
  };
}

const benefits = [
  "Link e código exclusivos",
  "Dashboard de cliques, cadastros e vendas",
  "60% do primeiro pagamento elegível",
  "Conta Pix protegida e verificada",
  "Ranking de parceiros",
];

export default function ParceirosCadastroPage() {
  const router = useRouter();
  const [form, setForm] =
    useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(
    () => passwordStrength(form.password),
    [form.password],
  );

  const completion = useMemo(() => {
    const values = [
      form.name.trim().length >= 2,
      form.email.includes("@"),
      form.whatsapp.replace(/\D/g, "").length >= 10,
      [11, 14].includes(
        form.document.replace(/\D/g, "").length,
      ),
      form.password.length >= 8,
      form.password === form.confirmPassword &&
        Boolean(form.confirmPassword),
      form.termsAccepted,
    ];

    return Math.round(
      (values.filter(Boolean).length / values.length) *
        100,
    );
  }, [form]);

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) return;

    if (form.password !== form.confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    if (!form.termsAccepted) {
      setError(
        "Leia e aceite os termos do programa para continuar.",
      );
      return;
    }

    setLoading(true);
    setError("");

    const response = await fetch(
      "/api/parceiros/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          whatsapp: form.whatsapp,
          document: form.document,
          termsAccepted: form.termsAccepted,
          marketingOptIn: form.marketingOptIn,
        }),
      },
    );

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível criar o cadastro.",
      );
      setLoading(false);
      return;
    }

    const { error: authError } =
      await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

    if (authError) {
      router.replace(
        "/parceiros/login?created=1",
      );
      return;
    }

    router.replace("/parceiros/painel");
  }

  const inputClass =
    "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition placeholder:text-slate-300 focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100";

  return (
    <main
      data-partner-portal
      className="min-h-[100dvh] overflow-hidden bg-[#edf3fa] px-4 py-5 text-[#071b3a] sm:px-6 sm:py-7"
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="partner-drift absolute -right-36 -top-48 h-[460px] w-[460px] rounded-full bg-blue-200/60 blur-3xl" />
        <div className="partner-drift absolute -bottom-48 -left-36 h-[420px] w-[420px] rounded-full bg-emerald-100/70 blur-3xl [animation-delay:-4s]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/parceiros"
            className="rounded-2xl bg-white px-4 py-3 shadow-lg"
          >
            <Image
              src="/logo-orcaly.png"
              alt="Orçaly"
              width={180}
              height={52}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <Link
            href="/parceiros/login"
            className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-sm transition hover:-translate-y-0.5"
          >
            Já tenho conta
          </Link>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
          <aside className="partner-fade-up relative overflow-hidden rounded-[2.2rem] bg-[#04152f] p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-8 lg:sticky lg:top-6">
            <div className="pointer-events-none absolute -right-36 -top-40 h-80 w-80 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />

            <div className="relative">
              <div className="inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[10px] font-black uppercase tracking-[0.17em] text-cyan-100">
                Cadastro do parceiro
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.065em] sm:text-5xl">
                Comece com regras claras e um portal só seu.
              </h1>

              <p className="mt-5 text-sm font-semibold leading-7 text-white/58">
                O cadastro é separado do painel de empresas. Você recebe um link exclusivo, acompanha o funil e organiza pagamentos sem depender de mensagens soltas.
              </p>

              <div className="mt-7 rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                      Cadastro preenchido
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {completion}%
                    </p>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-xl">
                    ↗
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-500"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {benefits.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 text-sm font-bold text-white/72"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-300 text-xs font-black text-[#071b3a]">
                      ✓
                    </span>
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-7 grid grid-cols-3 gap-2">
                {[
                  ["60%", "comissão"],
                  ["14 dias", "retenção"],
                  ["R$ 50", "mínimo"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-white/8 p-3"
                  >
                    <p className="text-lg font-black">
                      {value}
                    </p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.11em] text-white/35">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <form
            onSubmit={submit}
            className="partner-fade-up partner-delay-1 rounded-[2.2rem] border border-white bg-white p-5 shadow-[0_35px_100px_rgba(6,26,54,.12)] sm:p-8"
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[#1359a5]">
                  Seus dados
                </p>
                <h2 className="mt-2 text-3xl font-black leading-[1] tracking-[-0.055em] sm:text-4xl">
                  Crie sua conta de parceiro.
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                  Use dados verdadeiros. O CPF ou CNPJ precisa ser do titular da futura conta Pix.
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#05245c]">
                Leva poucos minutos
              </span>
            </div>

            <div aria-live="polite">
              {error ? (
                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                  {error}
                </div>
              ) : null}
            </div>

            <section className="mt-6">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#05245c] text-xs font-black text-white">
                  1
                </span>
                <div>
                  <p className="font-black">
                    Identificação
                  </p>
                  <p className="text-xs font-bold text-slate-400">
                    Quem será o titular da parceria
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700 sm:col-span-2">
                  Nome completo ou razão social
                  <input
                    value={form.name}
                    onChange={(event) =>
                      update("name", event.target.value)
                    }
                    required
                    className={inputClass}
                    placeholder="Nome do parceiro"
                  />
                </label>

                <label className="grid gap-2 text-sm font-black text-slate-700">
                  CPF ou CNPJ
                  <input
                    value={form.document}
                    onChange={(event) =>
                      update(
                        "document",
                        formatDocument(
                          event.target.value,
                        ),
                      )
                    }
                    inputMode="numeric"
                    required
                    className={inputClass}
                    placeholder="Documento do titular"
                  />
                </label>

                <label className="grid gap-2 text-sm font-black text-slate-700">
                  WhatsApp
                  <input
                    value={form.whatsapp}
                    onChange={(event) =>
                      update(
                        "whatsapp",
                        formatPhone(
                          event.target.value,
                        ),
                      )
                    }
                    inputMode="tel"
                    required
                    className={inputClass}
                    placeholder="(82) 99999-9999"
                  />
                </label>
              </div>
            </section>

            <section className="mt-8 border-t border-slate-100 pt-7">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#05245c] text-xs font-black text-white">
                  2
                </span>
                <div>
                  <p className="font-black">
                    Acesso ao portal
                  </p>
                  <p className="text-xs font-bold text-slate-400">
                    Conta independente do painel de clientes
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700 sm:col-span-2">
                  E-mail
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      update("email", event.target.value)
                    }
                    autoComplete="email"
                    required
                    className={inputClass}
                    placeholder="parceiro@email.com"
                  />
                </label>

                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Senha
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      update(
                        "password",
                        event.target.value,
                      )
                    }
                    autoComplete="new-password"
                    required
                    className={inputClass}
                    placeholder="Mínimo de 8 caracteres"
                  />
                </label>

                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Confirmar senha
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) =>
                      update(
                        "confirmPassword",
                        event.target.value,
                      )
                    }
                    autoComplete="new-password"
                    required
                    className={inputClass}
                    placeholder="Repita a senha"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-2xl bg-[#f7f9fc] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-slate-500">
                    Segurança da senha
                  </p>
                  <p className="text-xs font-black text-[#05245c]">
                    {strength.label}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${strength.tone}`}
                    style={{ width: strength.width }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-400">
                  Combine letras maiúsculas, minúsculas, números e um caractere especial.
                </p>
              </div>
            </section>

            <section className="mt-8 border-t border-slate-100 pt-7">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#05245c] text-xs font-black text-white">
                  3
                </span>
                <div>
                  <p className="font-black">
                    Regras da parceria
                  </p>
                  <p className="text-xs font-bold text-slate-400">
                    Leia antes de concluir
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-[1.5rem] border border-blue-100 bg-[#f7faff] p-4">
                <label className="flex items-start gap-3 text-sm font-bold leading-6 text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.termsAccepted}
                    onChange={(event) =>
                      update(
                        "termsAccepted",
                        event.target.checked,
                      )
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[#05245c]"
                  />
                  <span>
                    Li e aceito os{" "}
                    <Link
                      href="/parceiros/termos"
                      target="_blank"
                      className="font-black text-[#05245c] underline"
                    >
                      Termos de Uso e Participação
                    </Link>
                    , incluindo as regras de comissão, atribuição, retenção, estorno e uso da marca.
                  </span>
                </label>

                <label className="flex items-start gap-3 text-sm font-bold leading-6 text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.marketingOptIn}
                    onChange={(event) =>
                      update(
                        "marketingOptIn",
                        event.target.checked,
                      )
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[#05245c]"
                  />
                  Quero receber materiais, avisos e novidades do programa pelo WhatsApp.
                </label>
              </div>
            </section>

            <div className="mt-7 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800">
              O cadastro no programa não cria vínculo empregatício, exclusividade ou autorização para falar em nome do Orçaly. A parceria é comercial e independente.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="partner-shine mt-6 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Criando seu portal..."
                : "Criar conta de parceiro"}
            </button>

            <p className="mt-4 text-center text-xs font-bold leading-5 text-slate-400">
              Após o cadastro, você poderá gerar o link, configurar a conta Pix e acompanhar suas indicações.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
