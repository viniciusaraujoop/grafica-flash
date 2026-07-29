"use client";

// ORCALY_OWNER_SUPPORT_CONTROL_V1

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

export default function AdminAlterarSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setBusy(true);
    setError("");

    const { data } = await supabase.auth.getSession();
    const token =
      data.session?.access_token || "";

    const response = await fetch(
      "/api/admin/change-password",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      },
    );

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível alterar a senha.",
      );
      setBusy(false);
      return;
    }

    await supabase.auth.refreshSession();
    router.replace("/admin");
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#eef3f9] p-4 text-[#071b3a]">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-[2rem] border border-white bg-white p-6 shadow-[0_30px_90px_rgba(6,26,54,.14)] sm:p-8"
      >
        <Image
          src="/logo-orcaly.png"
          alt="Orçaly"
          width={180}
          height={52}
          priority
          className="h-11 w-auto"
        />

        <div className="mt-7 inline-flex rounded-full bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
          Proteção obrigatória
        </div>

        <h1 className="mt-4 text-4xl font-black tracking-[-0.055em]">
          Crie sua senha definitiva.
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          A senha temporária serviu apenas para o primeiro acesso. A nova senha será enviada diretamente ao Supabase Auth e não ficará visível no painel.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-black">
            Nova senha
            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-[#05245c] focus-within:ring-4 focus-within:ring-blue-100">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent px-4 py-4 font-semibold outline-none"
                placeholder="10+ caracteres, letra e número"
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

          <label className="grid gap-2 text-sm font-black">
            Confirmar senha
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(event) =>
                setConfirm(event.target.value)
              }
              autoComplete="new-password"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-xl shadow-blue-950/20 disabled:opacity-50"
          >
            {busy
              ? "Salvando..."
              : "Salvar senha e entrar"}
          </button>
        </div>
      </form>
    </main>
  );
}
