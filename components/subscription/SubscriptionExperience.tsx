"use client";

import {
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import MercadoPagoSubscriptionCheckout from "@/components/subscription/MercadoPagoSubscriptionCheckout";
import FounderSubscriptionPanel, {
  type FounderBillingCompany,
} from "@/components/subscription/FounderSubscriptionPanel";

type CurrentPayload = {
  company?: FounderBillingCompany & {
    is_founder?: boolean | null;
  };
  error?: string;
};

async function fetchCurrentCompany() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || "";

  if (!token) {
    return {
      kind: "unauthenticated" as const,
    };
  }

  const response = await fetch(
    "/api/company/current",
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const payload = (await response
    .json()
    .catch(() => ({}))) as CurrentPayload;

  return {
    kind: "response" as const,
    ok: response.ok,
    payload,
  };
}

export default function SubscriptionExperience() {
  const [company, setCompany] =
    useState<CurrentPayload["company"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    void fetchCurrentCompany()
      .then((result) => {
        if (ignore) return;

        if (result.kind === "unauthenticated") {
          window.location.assign("/login");
          return;
        }

        if (!result.ok) {
          setError(
            result.payload.error ||
              "Não foi possível carregar a assinatura.",
          );
          setLoading(false);
          return;
        }

        setCompany(result.payload.company || null);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;

        setError(
          "Não foi possível carregar a assinatura.",
        );
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="grid min-h-[60vh] place-items-center text-[#071b3a]">
        <p className="font-black">
          Carregando assinatura...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 font-bold text-red-700">
          {error}
        </div>
      </main>
    );
  }

  if (company?.is_founder === true) {
    return (
      <FounderSubscriptionPanel
        initialCompany={company}
      />
    );
  }

  return <MercadoPagoSubscriptionCheckout />;
}
