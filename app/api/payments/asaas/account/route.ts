import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  getAsaasCapabilities,
  requireAsaasMasterApiKey,
  requireAsaasRootWalletId,
} from "@/lib/payments/asaas-config";
import {
  encryptPaymentCredential,
} from "@/lib/payments/credential-encryption";
import {
  AsaasProvider,
} from "@/lib/payments/providers/asaas";
import {
  requireUserCompany,
} from "@/lib/payments/server-context";

export const runtime = "nodejs";

const PUBLIC_ACCOUNT_FIELDS =
  "id,provider_account_id,provider_wallet_id,onboarding_status,account_status,charges_enabled,payouts_enabled,card_enabled,pix_enabled,onboarding_url,legal_name,document_last4,bank_name,bank_account_last4,bank_account_type,last_status_check_at,is_active,created_at,updated_at";

function statusOf(error: unknown) {
  return Number(
    error &&
      typeof error === "object" &&
      "status" in error
      ? (
          error as {
            status?: number;
          }
        ).status || 500
      : 500,
  );
}

function digits(value: unknown) {
  return String(value || "")
    .replace(/\D/g, "");
}

function required(
  value: unknown,
  label: string,
) {
  const result =
    String(value || "").trim();

  if (!result) {
    throw Object.assign(
      new Error(
        `Informe ${label}.`,
      ),
      { status: 400 },
    );
  }

  return result;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const context =
      await requireUserCompany(
        request,
      );
    const companyId =
      String(context.company.id);

    const { data } =
      await context.supabase
        .from(
          "marketplace_payment_settings",
        )
        .select(
          PUBLIC_ACCOUNT_FIELDS,
        )
        .eq(
          "company_id",
          companyId,
        )
        .eq(
          "provider",
          "asaas",
        )
        .order(
          "updated_at",
          { ascending: false },
        )
        .limit(1)
        .maybeSingle();

    return NextResponse.json({
      configured:
        Boolean(
          data?.provider_account_id,
        ),
      provider: "asaas",
      accountStatus:
        data?.account_status ||
        null,
      onboardingStatus:
        data?.onboarding_status ||
        null,
      chargesEnabled:
        Boolean(
          data?.charges_enabled,
        ),
      payoutsEnabled:
        Boolean(
          data?.payouts_enabled,
        ),
      pixEnabled:
        Boolean(
          data?.pix_enabled,
        ),
      cardEnabled: false,
      onboardingUrl:
        data?.onboarding_url ||
        null,
      legalName:
        data?.legal_name || null,
      documentLast4:
        data?.document_last4 ||
        null,
      bankName:
        data?.bank_name || null,
      bankAccountLast4:
        data?.bank_account_last4 ||
        null,
      bankAccountType:
        data?.bank_account_type ||
        null,
      capabilities:
        getAsaasCapabilities(),
      suggested: {
        name: String(
          context.company.nome ||
            "",
        ),
        email: String(
          context.company.email ||
            context.user.email ||
            "",
        ),
        mobilePhone: String(
          context.company.telefone ||
            "",
        ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "NÃ£o foi possÃ­vel consultar a conta Asaas.",
      },
      {
        status:
          statusOf(error),
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const capabilities =
      getAsaasCapabilities();

    if (
      !capabilities.asaasEnabled ||
      !capabilities
        .subaccountsEnabled
    ) {
      return NextResponse.json(
        {
          error:
            "A criaÃ§Ã£o de subcontas Asaas nÃ£o estÃ¡ habilitada neste ambiente.",
        },
        { status: 409 },
      );
    }

    const masterApiKey =
      requireAsaasMasterApiKey();

    // Garante que nÃ£o cria uma subconta
    // se a configuraÃ§Ã£o mÃ­nima para o
    // marketplace estiver incompleta.
    requireAsaasRootWalletId();

    // Preflight da criptografia. A API key
    // da subconta Ã© retornada pelo Asaas
    // apenas uma vez.
    encryptPaymentCredential(
      "asaas-preflight",
    );

    const context =
      await requireUserCompany(
        request,
      );
    const body =
      await request.json();

    const companyId =
      String(context.company.id);

    const name = required(
      body.name ||
        context.company.nome,
      "o nome do titular",
    );

    const email = required(
      body.email ||
        context.user.email,
      "o e-mail",
    );

    const document =
      digits(body.cpfCnpj);

    if (
      ![11, 14].includes(
        document.length,
      )
    ) {
      throw Object.assign(
        new Error(
          "Informe um CPF ou CNPJ vÃ¡lido.",
        ),
        { status: 400 },
      );
    }

    const isCompany =
      document.length === 14;

    const birthDate =
      String(
        body.birthDate || "",
      ).trim();

    const companyType =
      String(
        body.companyType || "",
      ).trim();

    if (
      !isCompany &&
      !birthDate
    ) {
      throw Object.assign(
        new Error(
          "Informe a data de nascimento do titular.",
        ),
        { status: 400 },
      );
    }

    if (
      isCompany &&
      ![
        "MEI",
        "LIMITED",
        "INDIVIDUAL",
        "ASSOCIATION",
      ].includes(companyType)
    ) {
      throw Object.assign(
        new Error(
          "Selecione o tipo da empresa.",
        ),
        { status: 400 },
      );
    }

    const mobilePhone =
      digits(
        required(
          body.mobilePhone,
          "o celular",
        ),
      );

    const incomeValue =
      Number(
        body.incomeValue || 0,
      );

    if (
      !Number.isFinite(
        incomeValue,
      ) ||
      incomeValue <= 0
    ) {
      throw Object.assign(
        new Error(
          "Informe o faturamento ou renda mensal.",
        ),
        { status: 400 },
      );
    }

    const address =
      required(
        body.address,
        "o logradouro",
      );

    const addressNumber =
      required(
        body.addressNumber,
        "o nÃºmero do endereÃ§o",
      );

    const province =
      required(
        body.province,
        "o bairro",
      );

    const postalCode =
      digits(
        required(
          body.postalCode,
          "o CEP",
        ),
      );

    const {
      data: existing,
    } =
      await context.supabase
        .from(
          "marketplace_payment_settings",
        )
        .select("*")
        .eq(
          "company_id",
          companyId,
        )
        .eq(
          "provider",
          "asaas",
        )
        .maybeSingle();

    if (
      existing
        ?.provider_account_id
    ) {
      const {
        data: active,
        error,
      } =
        await context.supabase
          .from(
            "marketplace_payment_settings",
          )
          .update({
            is_active: true,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            existing.id,
          )
          .select(
            PUBLIC_ACCOUNT_FIELDS,
          )
          .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        ok: true,
        repeated: true,
        account: active,
      });
    }

    const provider =
      new AsaasProvider(
        masterApiKey,
      );

    const account =
      await provider
        .createProviderAccount({
          name,
          email,
          cpfCnpj:
            document,
          birthDate:
            isCompany
              ? undefined
              : birthDate,
          companyType:
            isCompany
              ? companyType
              : undefined,
          phone:
            digits(
              body.phone,
            ) ||
            undefined,
          mobilePhone,
          address,
          addressNumber,
          complement:
            String(
              body.complement ||
                "",
            ).trim() ||
            undefined,
          province,
          postalCode,
          incomeValue,
        });

    if (
      !account.apiKey ||
      !account.walletId ||
      !account.id
    ) {
      throw new Error(
        "O Asaas nÃ£o retornou a API key, a carteira ou o ID da subconta.",
      );
    }

    const payload = {
      company_id:
        companyId,
      provider: "asaas",
      provider_account_id:
        account.id,
      provider_wallet_id:
        account.walletId,
      encrypted_provider_api_key:
        encryptPaymentCredential(
          account.apiKey,
        ),
      onboarding_status:
        "created",
      account_status:
        account.status ||
        "PENDING",
      charges_enabled: false,
      payouts_enabled: false,
      card_enabled: false,
      pix_enabled: true,

      // Mercado Pago continua ativo
      // durante a migraÃ§Ã£o. O Asaas
      // Ã© selecionado explicitamente
      // pelos novos fluxos.
      is_active: true,

      onboarding_url:
        account.onboardingUrl ||
        null,
      legal_name: name,
      document_last4:
        document.slice(-4) ||
        null,
      last_error: null,
      provider_metadata_sanitized:
        {
          environment:
            capabilities.environment,
          migration_phase:
            "parallel_setup",
          created_by:
            "orcaly",
        },
      updated_at:
        new Date()
          .toISOString(),
    };

    const query =
      existing?.id
        ? context.supabase
            .from(
              "marketplace_payment_settings",
            )
            .update(payload)
            .eq(
              "id",
              existing.id,
            )
        : context.supabase
            .from(
              "marketplace_payment_settings",
            )
            .insert(
              payload,
            );

    const {
      data,
      error,
    } =
      await query
        .select(
          PUBLIC_ACCOUNT_FIELDS,
        )
        .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      account: data,
      next:
        "Atualize a situaÃ§Ã£o cadastral antes de ativar cobranÃ§as.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "NÃ£o foi possÃ­vel criar a subconta Asaas.",
      },
      {
        status:
          statusOf(error),
      },
    );
  }
}