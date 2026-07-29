"use client";

// ORCALY_OWNER_SUPPORT_CONTROL_V1

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Log = Record<string, any>;

async function currentToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function dateTime(value: unknown) {
  if (!value) return "Sem data";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsed);
}

function actionLabel(value: unknown) {
  const action = String(value || "");
  const labels: Record<string, string> = {
    owner_bootstrapped: "Login de dono configurado",
    support_created: "Suporte criado",
    support_permissions_updated:
      "Permissões de suporte alteradas",
    support_password_reset:
      "Senha temporária de suporte redefinida",
    support_activated: "Suporte reativado",
    support_deactivated: "Suporte desativado",
    affiliate_referral_reviewed:
      "Indicação revisada",
    affiliate_pix_revealed:
      "Chave Pix revelada",
    affiliate_profile_status_changed:
      "Parceiro alterado",
    affiliate_payout_account_verified:
      "Conta Pix verificada",
    affiliate_payout_created:
      "Lote de pagamento criado",
    affiliate_payout_approved:
      "Pagamento aprovado",
    affiliate_payout_sent: "Pix enviado",
    affiliate_payout_marked_paid:
      "Pagamento manual confirmado",
    affiliate_payout_cancelled:
      "Pagamento cancelado",
    affiliate_commission_reversed:
      "Comissão revertida",
  };

  return labels[action] || action.replace(/_/g, " ");
}

function stringify(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export default function AdminAuditoriaPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [selected, setSelected] =
    useState<Log | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = await currentToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const response = await fetch(
      "/api/admin/audit?limit=500",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

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
          "Não foi possível carregar a auditoria.",
      );
    } else {
      setLogs(payload.logs || []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (
        source !== "all" &&
        String(log.source) !== source
      ) {
        return false;
      }

      if (!query) return true;

      return [
        log.admin_email,
        log.actor_email,
        log.action,
        log.target_type,
        log.target_id,
        log.target_label,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [logs, search, source]);

  const today = useMemo(() => {
    const key = new Date().toDateString();
    return logs.filter(
      (log) =>
        new Date(log.created_at).toDateString() === key,
    ).length;
  }, [logs]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f9] text-[#071b3a]">
        <p className="font-black">
          Carregando trilha de auditoria...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] p-3 text-[#071b3a] sm:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
                Segurança e responsabilidade
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.055em] sm:text-5xl">
                Auditoria administrativa
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/55">
                Toda ação crítica deixa registro: criação de suporte, alteração de permissões, revisão de indicação, revelação de Pix e movimentação financeira.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
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

          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Registros", logs.length],
              ["Hoje", today],
              [
                "Eventos financeiros",
                logs.filter((log) =>
                  /payout|commission|pix/i.test(
                    String(log.action || ""),
                  ),
                ).length,
              ],
            ].map(([label, value]) => (
              <article
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-black">
                  {value}
                </p>
              </article>
            ))}
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700"
          >
            {error}
          </div>
        ) : null}

        <section className="mt-5 rounded-[1.5rem] border border-white bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              placeholder="Buscar por e-mail, ação ou registro..."
            />
            <select
              value={source}
              onChange={(event) =>
                setSource(event.target.value)
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold outline-none"
            >
              <option value="all">
                Todas as fontes
              </option>
              <option value="admin">
                Administração
              </option>
              <option value="affiliate">
                Programa de parceiros
              </option>
            </select>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[1.6rem] border border-white bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full">
              <thead className="bg-[#f7f9fc]">
                <tr>
                  {[
                    "Data",
                    "Responsável",
                    "Ação",
                    "Alvo",
                    "Fonte",
                    "",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr
                    key={`${log.source}:${log.id}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-4 text-xs font-bold text-slate-500">
                      {dateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-black">
                        {log.admin_email ||
                          log.actor_email ||
                          "Sistema"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-bold">
                        {log.target_label ||
                          log.target_type ||
                          "Registro interno"}
                      </p>
                      <p className="mt-1 max-w-[260px] truncate text-xs font-semibold text-slate-400">
                        {log.target_id || "Sem ID"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black uppercase text-slate-500">
                        {log.source === "affiliate"
                          ? "Parceiros"
                          : "Admin"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(log)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!filtered.length ? (
            <p className="border-t border-slate-100 p-10 text-center text-sm font-bold text-slate-400">
              Nenhum registro encontrado.
            </p>
          ) : null}
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[130] grid place-items-center overflow-y-auto bg-[#071b3a]/65 p-4 backdrop-blur-sm">
          <section className="my-auto w-full max-w-2xl rounded-[1.8rem] bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#1359a5]">
                  Evento auditado
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {actionLabel(selected.action)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl font-black"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                [
                  "Responsável",
                  selected.admin_email ||
                    selected.actor_email ||
                    "Sistema",
                ],
                ["Data", dateTime(selected.created_at)],
                [
                  "Tipo do alvo",
                  selected.target_type || "—",
                ],
                [
                  "Identificador",
                  selected.target_id || "—",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl bg-[#f7f9fc] p-4"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 break-all text-sm font-black">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Metadados do evento
              </p>
              <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-[#071b3a] p-4 text-xs leading-6 text-cyan-100">
                {stringify(
                  selected.payload ||
                    selected.metadata ||
                    {},
                ) || "{}"}
              </pre>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
