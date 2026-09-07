import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionSnapshot,
  manageCompanySubscription,
  resolveSubscriptionContext,
} from "@/lib/subscription-service";
import { requireMfaStepUpForRequest } from "@/lib/security/mfa";
import {
  normalizeSubscriptionMutationAction,
  requiresSubscriptionMfa,
} from "@/lib/security/privileged-actions";
import { recordPrivilegedAudit } from "@/lib/security/privileged-audit";

function statusForMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("não autorizado")) return 401;
  if (normalized.includes("permissão")) return 403;
  if (normalized.includes("não encontrada")) return 404;
  return 400;
}

function mfaFailurePayload(decision: Awaited<ReturnType<typeof requireMfaStepUpForRequest>>) {
  return {
    error: decision.error,
    code: decision.reason === "mfa_enrollment_required"
      ? "MFA_ENROLLMENT_REQUIRED"
      : "MFA_STEP_UP_REQUIRED",
    reason: decision.reason,
  };
}

export async function GET(request: NextRequest) {
  try {
    const snapshot = await getSubscriptionSnapshot(request);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar assinatura.";
    return NextResponse.json({ error: message }, { status: statusForMessage(message) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = normalizeSubscriptionMutationAction(body?.action);
    let auditContext: Awaited<ReturnType<typeof resolveSubscriptionContext>> | null = null;

    if (requiresSubscriptionMfa(action)) {
      auditContext = await resolveSubscriptionContext(request);
      if (!auditContext.user) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
      }
      if (!auditContext.company?.id) {
        return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
      }
      if (!auditContext.canManage) {
        return NextResponse.json({ error: "Você não possui permissão para gerenciar a assinatura." }, { status: 403 });
      }

      const mfa = await requireMfaStepUpForRequest(request, "subscription.manage");
      if (!mfa.allowed) {
        await recordPrivilegedAudit(auditContext.admin, request, {
          companyId: auditContext.company.id,
          userId: auditContext.user.id,
          action: `subscription.${action}`,
          entity: "subscription",
          entityId: auditContext.company.id,
          result: "denied",
          details: { reason: mfa.reason, assurance_level: mfa.state.currentLevel },
        });
        return NextResponse.json(mfaFailurePayload(mfa), { status: mfa.status });
      }
    }

    const result = await manageCompanySubscription(request, body);

    if (auditContext?.user && auditContext.company?.id) {
      await recordPrivilegedAudit(auditContext.admin, request, {
        companyId: auditContext.company.id,
        userId: auditContext.user.id,
        action: `subscription.${action}`,
        entity: "subscription",
        entityId: auditContext.company.id,
        result: "success",
        details: { assurance_level: "aal2" },
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerenciar assinatura.";
    return NextResponse.json({ error: message }, { status: statusForMessage(message) });
  }
}
