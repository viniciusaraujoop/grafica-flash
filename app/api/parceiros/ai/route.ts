/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";
import { AffiliateError, affiliateStatusCode, requireAffiliate } from "@/lib/affiliates/server";

type Mode = "message" | "objection" | "followup" | "post";

const REAL_CAPABILITIES = [
  "site e vitrine digital por empresa",
  "orçamentos e propostas",
  "pedidos e acompanhamento de status",
  "clientes e CRM",
  "financeiro e pagamentos quando configurados",
  "catálogo, produtos ou cardápio conforme o segmento",
  "entregas e operação conforme o segmento",
  "aprovação de arte para segmentos compatíveis",
  "portal do cliente e acompanhamento por link seguro",
  "Central do Dia e organização operacional",
];

function text(value: unknown, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function localFallback(mode: Mode, input: Record<string, unknown>) {
  const segment = text(input.segment, 80) || "empresa";
  const name = text(input.name, 100);
  const context = text(input.context, 500);
  if (mode === "objection") {
    return `Entendo. A ideia do Orçaly não é trocar uma ferramenta que já funciona só por trocar. O ponto é reunir atendimento, orçamento, pedidos, clientes e acompanhamento em um fluxo único para reduzir retrabalho. Para uma ${segment}, eu mostraria primeiro a parte que hoje mais toma tempo e compararia na prática.`;
  }
  if (mode === "followup") {
    return `Olá${name ? `, ${name}` : ""}! Passando para retomar nossa conversa sobre o Orçaly. Posso te mostrar rapidamente como ele organiza orçamento, pedidos e clientes em um fluxo só${context ? `, considerando ${context}` : ""}. Se fizer sentido, te envio a demonstração.`;
  }
  if (mode === "post") {
    return `Headline: Menos planilha. Mais operação organizada.\nTexto: O Orçaly reúne orçamento, pedidos, clientes e acompanhamento em um só fluxo para ${segment}.\nCTA: Veja uma demonstração pelo meu link.`;
  }
  return `Olá! Trabalho com o Orçaly, uma plataforma para organizar o fluxo da empresa do orçamento ao pedido e acompanhamento do cliente. Para ${segment}, posso te mostrar uma demonstração curta e você avalia se faz sentido para sua rotina.`;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAffiliate(request);
    const body = await readJsonBody<any>(request, 12 * 1024);
    const modeValue = text(body.mode, 30) as Mode;
    const mode: Mode = ["message", "objection", "followup", "post"].includes(modeValue) ? modeValue : "message";
    const fallback = localFallback(mode, body);

    const burstBlocked = await enforceRateLimit(request, {
      scope: "partner-ai-user-minute",
      identity: profile.id,
      limit: 8,
      windowSeconds: 60,
    });
    if (burstBlocked) return burstBlocked;

    const dailyBlocked = await enforceRateLimit(request, {
      scope: "partner-ai-daily",
      identity: profile.id,
      limit: 80,
      windowSeconds: 86_400,
    });
    if (dailyBlocked) return dailyBlocked;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: true, source: "fallback", answer: fallback });
    }

    const objective = text(body.objective, 300);
    const channel = text(body.channel, 80) || "WhatsApp";
    const tone = text(body.tone, 80) || "profissional e humano";
    const objection = text(body.objection, 500);
    const context = text(body.context, 1200);
    const name = text(body.name, 100);
    const segment = text(body.segment, 80);

    const instruction: Record<Mode, string> = {
      message: "Crie uma mensagem comercial curta, pronta para revisão, sem promessas exageradas.",
      objection: "Responda à objeção com empatia e argumento comercial baseado apenas nas funcionalidades confirmadas.",
      followup: "Crie um follow-up curto. Não presuma que o prospect viu, abriu ou aprovou algo sem contexto que confirme isso.",
      post: "Gere headline, texto curto e CTA para uma publicação comercial. Não invente desconto, preço ou funcionalidade.",
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ORCALY_AI_MODEL || "gpt-4.1-mini",
        temperature: 0.45,
        messages: [
          {
            role: "system",
            content: [
              "Você é o copiloto comercial do Portal de Parceiros do Orçaly.",
              "Responda em português do Brasil.",
              instruction[mode],
              "O parceiro SEMPRE revisa antes de enviar. Nunca diga que enviou mensagem.",
              "Use somente capacidades reais abaixo. Se algo não estiver listado, não invente.",
              REAL_CAPABILITIES.join("; "),
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({ mode, name, segment, channel, tone, objective, objection, context }),
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({
        ok: true,
        source: "fallback",
        warning: payload?.error?.message || "IA externa indisponível.",
        answer: fallback,
      });
    }

    return NextResponse.json({
      ok: true,
      source: "openai",
      answer: payload?.choices?.[0]?.message?.content || fallback,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    if (error instanceof AffiliateError) {
      return NextResponse.json({ error: error.message }, { status: affiliateStatusCode(error) });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar a sugestão." },
      { status: 500 },
    );
  }
}
