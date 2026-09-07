"use client";

// ORCALY_OWNER_SUPPORT_CONTROL_V1

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Json = Record<string, any>;

const initialForm = {
  nome: "",
  email: "",
  password: "",
  observacoes: "",
  permissions: {} as Record<string, boolean>,
};

async function currentToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function dateTime(value: unknown) {
  if (!value) return "Ainda não acessou";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return "Ainda não acessou";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

export default function AdminEquipePage() {
  const router = useRouter();
  const [team, setTeam] = useState<Json[]>([]);
  const [catalog, setCatalog] = useState<Json[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState<Json | null>(null);
  const [resetMember, setResetMember] =
    useState<Json | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = await currentToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const response = await fetch("/api/admin/team", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        router.replace("/admin");
        return;
      }

      setError(
        payload.error ||
          "Não foi possível carregar a equipe.",
      );
    } else {
      setTeam(payload.team || []);
      setCatalog(payload.permissionCatalog || []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(
    actionName: string,
    body: Record<string, unknown>,
  ) {
    setBusy(actionName);
    setMessage("");
    setError("");

    const token = await currentToken();
    const response = await fetch("/api/admin/team", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: actionName,
        ...body,
      }),
    });

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível concluir a operação.",
      );
      setBusy("");
      return false;
    }

    setMessage(
      payload.message || "Alteração salva.",
    );
    setBusy("");
    await load();
    return true;
  }

  async function createSupport(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const saved = await action("create_support", {
      ...form,
    });

    if (saved) {
      setForm(initialForm);
    }
  }

  async function saveEditing(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!editing?.id) return;

    const saved = await action("update_support", {
      id: editing.id,
      nome: editing.nome,
      observacoes: editing.observacoes,
      permissions: editing.permissions || {},
    });

    if (saved) {
      setEditing(null);
    }
  }

  async function submitReset(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!resetMember?.id) return;

    const saved = await action("reset_password", {
      id: resetMember.id,
      password: resetPassword,
    });

    if (saved) {
      setResetMember(null);
      setResetPassword("");
    }
  }

  const owners = useMemo(
    () => team.filter((item) => item.role === "owner"),
    [team],
  );
  const supports = useMemo(
    () => team.filter((item) => item.role === "support"),
    [team],
  );

  function permissionToggle(
    current: Record<string, boolean>,
    key: string,
  ) {
    return {
      ...current,
      [key]: !current[key],
    };
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f9] text-[#071b3a]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
          <p className="mt-4 font-black">
            Carregando equipe interna...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] p-3 text-[#071b3a] sm:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
          <div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-200/15 bg-cyan-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.17em] text-cyan-100">
                Exclusivo do dono
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.055em] sm:text-5xl">
                Equipe administrativa
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/55">
                Crie acessos de suporte e escolha exatamente o que cada pessoa pode consultar. Enviar Pix, revelar chave completa, reverter comissão e gerenciar a equipe continuam bloqueados para suporte.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/equipe/comercial"
                className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100"
              >
                Equipe comercial
              </Link>
              <Link
                href="/admin"
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white"
              >
                Voltar ao controle
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700"
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
          <form
            onSubmit={createSupport}
            className="h-fit rounded-[1.8rem] border border-white bg-white p-5 shadow-sm xl:sticky xl:top-5"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#1359a5]">
              Novo acesso
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
              Adicionar suporte
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Use um e-mail exclusivo. A senha temporária é enviada apenas nesta operação e nunca fica salva na tabela administrativa.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                Nome
                <input
                  value={form.nome}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nome: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  placeholder="Nome do atendente"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                E-mail de acesso
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  placeholder="suporte@orcaly.com"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Senha temporária
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  autoComplete="new-password"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  placeholder="10+ caracteres, letra e número"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Observação interna
                <textarea
                  value={form.observacoes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      observacoes: event.target.value,
                    }))
                  }
                  rows={3}
                  className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  placeholder="Turno, responsabilidade ou restrição"
                />
              </label>
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                Permissões
              </p>
              <div className="mt-3 grid gap-2">
                {catalog.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-[#f8faff] p-3"
                  >
                    <input
                      type="checkbox"
                      checked={
                        form.permissions[item.key] === true
                      }
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          permissions: permissionToggle(
                            current.permissions,
                            item.key,
                          ),
                        }))
                      }
                      className="mt-1 h-4 w-4 accent-[#05245c]"
                    />
                    <span>
                      <span className="block text-sm font-black">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-400">
                        {item.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={busy === "create_support"}
              className="mt-5 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 disabled:opacity-50"
            >
              {busy === "create_support"
                ? "Criando acesso..."
                : "Criar login de suporte"}
            </button>
          </form>

          <section className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Donos ativos
                </p>
                <p className="mt-2 text-3xl font-black text-[#05245c]">
                  {owners.filter((item) => item.is_active).length}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Controle integral da plataforma
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-white bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Suportes cadastrados
                </p>
                <p className="mt-2 text-3xl font-black text-[#05245c]">
                  {supports.length}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {supports.filter((item) => item.is_active).length} ativos
                </p>
              </article>
            </div>

            <div className="mt-4 grid gap-3">
              {team.map((member) => {
                const memberPermissions =
                  member.permissions &&
                  typeof member.permissions === "object"
                    ? member.permissions
                    : {};

                return (
                  <article
                    key={member.id}
                    className="rounded-[1.6rem] border border-white bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">
                            {member.nome || member.email}
                          </h3>
                          <span
                            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] ${
                              member.role === "owner"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-blue-50 text-[#05245c]"
                            }`}
                          >
                            {member.role === "owner"
                              ? "Dono"
                              : member.role === "prospector"
                                ? "Prospector"
                                : "Suporte"}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1.5 text-[10px] font-black ${
                              member.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {member.is_active ? "Ativo" : "Desativado"}
                          </span>
                        </div>

                        <p className="mt-2 break-all text-sm font-bold text-slate-500">
                          {member.email}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          Último acesso: {dateTime(member.last_login_at)}
                        </p>
                        {member.observacoes ? (
                          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                            {member.observacoes}
                          </p>
                        ) : null}

                        {member.role !== "owner" ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {catalog
                              .filter(
                                (item) =>
                                  memberPermissions[item.key] === true,
                              )
                              .map((item) => (
                                <span
                                  key={item.key}
                                  className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-black text-[#05245c]"
                                >
                                  {item.label}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs font-black text-violet-700">
                            Acesso completo. Esta conta não pode ser alterada pela tela de equipe.
                          </p>
                        )}
                      </div>

                      {member.role === "support" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({
                                ...member,
                                permissions: {
                                  ...memberPermissions,
                                },
                              })
                            }
                            className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-black text-[#05245c]"
                          >
                            Editar permissões
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setResetMember(member)
                            }
                            className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-700"
                          >
                            Redefinir senha
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void action("set_active", {
                                id: member.id,
                                active: !member.is_active,
                              })
                            }
                            className={`rounded-xl border px-3 py-2.5 text-xs font-black ${
                              member.is_active
                                ? "border-red-100 bg-red-50 text-red-700"
                                : "border-emerald-100 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {member.is_active
                              ? "Desativar"
                              : "Reativar"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-[#071b3a]/65 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveEditing}
            className="my-auto w-full max-w-2xl rounded-[1.8rem] bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#1359a5]">
                  Editar suporte
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {editing.email}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl font-black"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-black">
                Nome
                <input
                  value={editing.nome || ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current
                        ? {
                            ...current,
                            nome: event.target.value,
                          }
                        : current,
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm font-black">
                Observação
                <textarea
                  value={editing.observacoes || ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current
                        ? {
                            ...current,
                            observacoes: event.target.value,
                          }
                        : current,
                    )
                  }
                  rows={3}
                  className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-[#f8faff] p-3"
                  >
                    <input
                      type="checkbox"
                      checked={
                        editing.permissions?.[item.key] === true
                      }
                      onChange={() =>
                        setEditing((current) =>
                          current
                            ? {
                                ...current,
                                permissions: permissionToggle(
                                  current.permissions || {},
                                  item.key,
                                ),
                              }
                            : current,
                        )
                      }
                      className="mt-1 h-4 w-4 accent-[#05245c]"
                    />
                    <span>
                      <span className="block text-sm font-black">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-slate-400">
                        {item.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-2xl border border-slate-200 px-4 py-4 font-black text-slate-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy === "update_support"}
                className="rounded-2xl bg-[#05245c] px-4 py-4 font-black text-white disabled:opacity-50"
              >
                Salvar permissões
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {resetMember ? (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-[#071b3a]/65 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitReset}
            className="w-full max-w-md rounded-[1.8rem] bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">
              Redefinição de acesso
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Nova senha temporária
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              A senha será enviada ao Supabase Auth e não aparecerá novamente no painel.
            </p>

            <input
              type="password"
              value={resetPassword}
              onChange={(event) =>
                setResetPassword(event.target.value)
              }
              autoComplete="new-password"
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none"
              placeholder="10+ caracteres, letra e número"
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setResetMember(null);
                  setResetPassword("");
                }}
                className="rounded-2xl border border-slate-200 px-4 py-4 font-black text-slate-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy === "reset_password"}
                className="rounded-2xl bg-[#05245c] px-4 py-4 font-black text-white disabled:opacity-50"
              >
                Redefinir
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
