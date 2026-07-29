"use client";

// ORCALY_AFFILIATE_VISUAL_V2

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

const previewRows = [
  ["Gráfica M***", "Em teste", "R$ 59,94"],
  ["Studio A***", "Em retenção", "R$ 89,94"],
  ["Oficina R***", "Disponível", "R$ 29,94"],
];

export default function ParceirosLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Entre com a conta exclusiva do Portal de Parceiros.",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    const created =
      new URLSearchParams(window.location.search).get(
        "created",
      ) === "1";

    if (created) {
      setMessage(
        "Conta criada. Entre para acessar seu link e configurar a conta Pix.",
      );
    }

    try {
      const saved = window.localStorage.getItem(
        "orcaly:affiliate:email:v1",
      );

      if (saved) setEmail(saved);
    } catch {
      // O login continua normalmente.
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        router.replace("/parceiros/painel");
      }
    });
  }, [router]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("Validando seu acesso...");

    const normalizedEmail = email.trim().toLowerCase();

    const { data, error: authError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (authError || !data.session?.access_token) {
      setError(
        authError?.message ===
          "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : authError?.message ||
              "Não foi possível entrar.",
      );
      setMessage("");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/parceiros", {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({}));

      await supabase.auth.signOut();
      setError(
        payload.error ||
          "Esta conta não pertence ao Portal de Parceiros.",
      );
      setMessage("");
      setLoading(false);
      return;
    }

    try {
      if (remember) {
        window.localStorage.setItem(
          "orcaly:affiliate:email:v1",
          normalizedEmail,
        );
      } else {
        window.localStorage.removeItem(
          "orcaly:affiliate:email:v1",
        );
      }
    } catch {
      // Preferência opcional.
    }

    setMessage(
      "Acesso confirmado. Abrindo seu portal...",
    );
    router.replace("/parceiros/painel");
  }

  return (
    <main
      data-partner-portal
      className="grid min-h-[100dvh] overflow-hidden bg-[#edf3fa] lg:grid-cols-[1fr_520px]"
    >
      <section className="relative hidden overflow-hidden bg-[#04152f] p-8 text-white lg:flex lg:flex-col xl:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:54px_54px]" />
          <div className="partner-drift absolute -left-56 -top-64 h-[640px] w-[640px] rounded-full bg-blue-500/30 blur-3xl" />
          <div className="partner-drift absolute -right-52 bottom-[-180px] h-[520px] w-[520px] rounded-full bg-emerald-400/18 blur-3xl [animation-delay:-4s]" />
        </div>

        <Link
          href="/parceiros"
          className="relative inline-flex self-start rounded-2xl bg-white px-4 py-3 shadow-xl"
        >
          <Image
            src="/logo-orcaly.png"
            alt="Orçaly"
            width={190}
            height={56}
            priority
            className="h-11 w-auto"
          />
        </Link>

        <div className="relative my-auto grid items-center gap-10 xl:grid-cols-[.82fr_1.18fr]">
          <div className="partner-fade-up">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              Portal de Parceiros
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[0.96] tracking-[-0.07em] xl:text-6xl">
              Suas indicações deixaram de depender de planilha.
            </h1>
            <p className="mt-6 text-base font-semibold leading-8 text-white/60">
              Acompanhe cadastros, pagamentos, retenções, saldo disponível e Pix em um painel feito só para parceiros.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["60%", "comissão"],
                ["14 dias", "retenção"],
                ["Pix", "pagamento"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
                >
                  <p className="text-2xl font-black">
                    {value}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="partner-float partner-fade-up partner-delay-2 rounded-[2rem] border border-white/12 bg-white/[0.08] p-3 shadow-[0_35px_100px_rgba(0,0,0,.25)] backdrop-blur-xl">
            <div className="rounded-[1.5rem] bg-white p-5 text-[#071b3a]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#1359a5]">
                    Resumo do portal
                  </p>
                  <p className="mt-1 text-lg font-black">
                    Operação organizada
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700">
                  Online
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["Cadastros", "21"],
                  ["Clientes pagos", "6"],
                  ["Em retenção", "R$ 419,58"],
                  ["Disponível", "R$ 209,79"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-blue-100 bg-[#f7faff] p-3"
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-black text-[#05245c]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2">
                {previewRows.map(
                  ([name, status, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3"
                    >
                      <div>
                        <p className="text-xs font-black">
                          {name}
                        </p>
                        <p className="mt-1 text-[9px] font-bold text-slate-400">
                          {status}
                        </p>
                      </div>
                      <p className="text-xs font-black text-emerald-700">
                        {value}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-xs font-bold text-white/30">
          Conta independente do painel de empresas do Orçaly.
        </p>
      </section>

      <section className="relative flex items-center px-4 py-6 sm:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-100/50 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <Link
            href="/parceiros"
            className="partner-fade-up mb-5 inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg lg:hidden"
          >
            <Image
              src="/logo-orcaly.png"
              alt="Orçaly"
              width={170}
              height={50}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <form
            onSubmit={submit}
            className="partner-fade-up partner-delay-1 rounded-[2.1rem] border border-white bg-white p-5 shadow-[0_35px_100px_rgba(6,26,54,.16)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#05245c]">
                  Acesso exclusivo
                </div>
                <h2 className="mt-5 text-4xl font-black leading-[1] tracking-[-0.06em] text-[#071b3a]">
                  Bem-vindo de volta.
                </h2>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#071b3a] text-lg text-white">
                ↗
              </span>
            </div>

            <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
              Entre com a conta criada especificamente para o programa de indicações.
            </p>

            <div
              aria-live="polite"
              className={`mt-5 rounded-2xl border p-4 text-sm font-bold leading-6 ${
                error
                  ? "border-red-100 bg-red-50 text-red-700"
                  : "border-blue-100 bg-blue-50 text-[#05245c]"
              }`}
            >
              {error || message}
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                E-mail
                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  autoComplete="email"
                  required
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="parceiro@email.com"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Senha
                <div className="flex rounded-2xl border border-slate-200 bg-slate-50 transition focus-within:border-[#05245c] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    autoComplete="current-password"
                    required
                    className="min-w-0 flex-1 bg-transparent px-4 py-4 font-semibold outline-none"
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShow((current) => !current)
                    }
                    className="px-4 text-xs font-black text-[#05245c]"
                  >
                    {show ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) =>
                      setRemember(
                        event.target.checked,
                      )
                    }
                    className="h-4 w-4 accent-[#05245c]"
                  />
                  Lembrar meu e-mail
                </label>

                <a
                  href="mailto:orcalybr@gmail.com?subject=Ajuda%20com%20o%20Portal%20de%20Parceiros"
                  className="text-xs font-black text-[#05245c] hover:underline"
                >
                  Preciso de ajuda
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="partner-shine rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Entrando com segurança..."
                  : "Entrar no portal"}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-100 bg-[#f8faff] p-4">
              <p className="text-xs font-black text-[#071b3a]">
                Conta separada, dados protegidos
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                O login do parceiro não dá acesso a pedidos, clientes ou configurações das empresas no Orçaly.
              </p>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm font-bold text-slate-500">
              Ainda não é parceiro?{" "}
              <Link
                href="/parceiros/cadastro"
                className="font-black text-[#05245c] hover:underline"
              >
                Criar conta
              </Link>
            </div>
          </form>

          <p className="mt-5 text-center text-xs font-bold text-slate-400">
            Ao entrar, você continua sujeito aos{" "}
            <Link
              href="/parceiros/termos"
              className="font-black text-[#05245c]"
            >
              termos do programa
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
