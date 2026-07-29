"use client";

// ORCALY_OWNER_SUPPORT_CONTROL_V1

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

const EMAIL_KEY =
  "orcaly_admin_email_v1";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [remember, setRemember] =
    useState(true);
  const [showPassword, setShowPassword] =
    useState(false);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    "Entre com uma conta interna autorizada.",
  );

  useEffect(() => {
    try {
      setEmail(
        window.localStorage.getItem(
          EMAIL_KEY,
        ) || "",
      );
    } catch {
      setEmail("");
    }

    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const token =
          data.session?.access_token;
        if (!token) return;

        const response = await fetch(
          "/api/admin/session",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        if (response.ok) {
          const payload = await response
            .json()
            .catch(() => ({}));

          router.replace(
            payload.admin?.mustChangePassword
              ? "/admin/alterar-senha"
              : "/admin",
          );
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
    setMessage("Validando acesso interno...");

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const { data, error: authError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (
      authError ||
      !data.session?.access_token
    ) {
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

    const response = await fetch(
      "/api/admin/session",
      {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
        cache: "no-store",
      },
    );

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      await supabase.auth.signOut();
      setError(
        payload.error ||
          "Esta conta não possui acesso administrativo.",
      );
      setMessage("");
      setLoading(false);
      return;
    }

    try {
      if (remember) {
        window.localStorage.setItem(
          EMAIL_KEY,
          normalizedEmail,
        );
      } else {
        window.localStorage.removeItem(
          EMAIL_KEY,
        );
      }
    } catch {
      // A sessão continua normalmente.
    }

    setMessage(
      payload.admin?.role === "owner"
        ? "Acesso de dono confirmado."
        : "Acesso interno confirmado.",
    );
    router.replace(
      payload.admin?.mustChangePassword
        ? "/admin/alterar-senha"
        : "/admin",
    );
  }

  return (
    <main className="grid min-h-[100dvh] bg-[#eef3f9] lg:grid-cols-[1.08fr_520px]">
      <section className="relative hidden overflow-hidden bg-[#03152f] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:52px_52px]" />
          <div className="absolute -left-52 -top-64 h-[620px] w-[620px] rounded-full bg-blue-500/28 blur-3xl" />
          <div className="absolute -right-48 bottom-[-180px] h-[540px] w-[540px] rounded-full bg-cyan-400/16 blur-3xl" />
        </div>

        <Link
          href="/"
          className="relative inline-flex self-start rounded-2xl bg-white px-4 py-3"
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

        <div className="relative my-auto max-w-2xl">
          <span className="inline-flex rounded-full border border-cyan-200/15 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.17em] text-cyan-100">
            Centro de controle
          </span>
          <h1 className="mt-6 text-6xl font-black leading-[0.95] tracking-[-0.07em]">
            Administração interna do Orçaly.
          </h1>
          <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-white/58">
            Parceiros, indicações, comissões, pagamentos, equipe e auditoria em uma área separada dos clientes.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["DONO", "controle total"],
              ["SUPORTE", "acesso limitado"],
              ["AUDITADO", "ações registradas"],
            ].map(([value, label]) => (
              <div
                key={value}
                className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
              >
                <p className="text-lg font-black">
                  {value}
                </p>
                <p className="mt-1 text-xs font-bold text-white/40">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs font-bold leading-5 text-white/32">
          Senhas não são exibidas nem armazenadas no painel administrativo.
        </p>
      </section>

      <section className="relative flex items-center px-4 py-7 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-5 inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg lg:hidden"
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
            className="rounded-[2rem] border border-white bg-white p-5 shadow-[0_30px_90px_rgba(6,26,54,.15)] sm:p-8"
          >
            <div className="inline-flex rounded-full bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#05245c]">
              Login administrativo
            </div>

            <h2 className="mt-5 text-4xl font-black tracking-[-0.055em] text-[#071b3a]">
              Acesse o controle geral.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              Use uma conta cadastrada como dono ou suporte interno.
            </p>

            {error ? (
              <div
                aria-live="polite"
                className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700"
              >
                {error}
              </div>
            ) : (
              <div
                aria-live="polite"
                className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]"
              >
                {message}
              </div>
            )}

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                E-mail
                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  autoComplete="email"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="admin@orcaly.com"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Senha
                <div className="flex rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-[#05245c] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    autoComplete="current-password"
                    className="min-w-0 flex-1 bg-transparent px-4 py-4 font-semibold outline-none"
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current,
                      )
                    }
                    className="px-4 text-xs font-black text-[#05245c]"
                  >
                    {showPassword
                      ? "Ocultar"
                      : "Mostrar"}
                  </button>
                </div>
              </label>

              <label className="flex items-center gap-3 text-sm font-bold text-slate-500">
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
                Lembrar meu e-mail neste dispositivo
              </label>

              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Validando..."
                  : "Entrar no centro de controle"}
              </button>
            </div>

            <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs font-bold leading-5 text-slate-400">
              Acesso exclusivo da equipe interna. Tentativas e ações administrativas são registradas.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
