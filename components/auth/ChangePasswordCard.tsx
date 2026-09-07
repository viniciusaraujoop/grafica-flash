"use client";

// ORCALY_SELF_PASSWORD_SETTINGS_V1
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type ChangePasswordCardProps = {
  title?: string;
  description?: string;
  compact?: boolean;
};

function friendlyPasswordError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("current password") ||
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid password")
  ) {
    return "A senha atual está incorreta.";
  }

  if (
    normalized.includes("same password") ||
    normalized.includes("different from the old password")
  ) {
    return "A nova senha precisa ser diferente da senha atual.";
  }

  if (
    normalized.includes("weak") ||
    normalized.includes("password should") ||
    normalized.includes("password must")
  ) {
    return "A nova senha não atende aos requisitos de segurança.";
  }

  if (
    normalized.includes("reauth") ||
    normalized.includes("nonce")
  ) {
    return "Por segurança, entre novamente na conta antes de alterar a senha.";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many")
  ) {
    return "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.";
  }

  return "Não foi possível alterar a senha agora.";
}

export default function ChangePasswordCard({
  title = "Alterar senha",
  description = "Confirme sua senha atual e escolha uma nova senha para esta conta.",
  compact = false,
}: ChangePasswordCardProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setMessage("");
    setError("");

    if (!currentPassword) {
      setError("Informe sua senha atual.");
      return;
    }

    if (
      newPassword.length < 10 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      setError(
        "A nova senha precisa ter pelo menos 10 caracteres, com letra e número.",
      );
      return;
    }

    if (newPassword === currentPassword) {
      setError("A nova senha precisa ser diferente da senha atual.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmação da nova senha não confere.");
      return;
    }

    setBusy(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        setError(
          "Sua sessão não pôde ser confirmada. Entre novamente na conta.",
        );
        return;
      }

      if (!user.email) {
        setError(
          "Esta conta não possui e-mail de login disponível para confirmar a senha atual.",
        );
        return;
      }

      // Confirma a senha atual com uma autenticação real antes da troca.
      // Isso protege o fluxo mesmo se a opção administrativa
      // "Require current password" do Supabase for alterada no projeto.
      const { error: reauthError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

      if (reauthError) {
        setError(
          reauthError.message.toLowerCase().includes("invalid login credentials")
            ? "A senha atual está incorreta."
            : friendlyPasswordError(reauthError.message),
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });

      if (updateError) {
        setError(friendlyPasswordError(updateError.message));
        return;
      }

      await supabase.auth.refreshSession();

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Senha alterada com sucesso.");
    } catch {
      setError("Não foi possível alterar a senha agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      data-account-security
      className={
        compact
          ? "rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6"
          : "rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#1359a5]">
            Segurança da conta
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#071b3a]">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
            {description}
          </p>
        </div>
        <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
          Supabase Auth
        </span>
      </div>

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700"
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-black text-slate-700">
          Senha atual
          <input
            type={showPasswords ? "text" : "password"}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={128}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-black text-slate-700">
            Nova senha
            <input
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              maxLength={128}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-black text-slate-700">
            Confirmar nova senha
            <input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              maxLength={128}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-[#f7f9fc] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black text-[#071b3a]">
              Requisitos da nova senha
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Pelo menos 10 caracteres, incluindo letra e número.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-black text-[#05245c]">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(event) =>
                setShowPasswords(event.target.checked)
              }
            />
            Mostrar senhas
          </label>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-xl shadow-blue-950/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Alterando senha..." : "Alterar minha senha"}
        </button>
      </form>

      <p className="mt-4 text-xs font-semibold leading-5 text-slate-400">
        A senha é enviada diretamente ao Supabase Auth. O Orçaly não grava a
        senha em tabelas próprias nem a inclui em logs do painel.
      </p>
    </section>
  );
}
