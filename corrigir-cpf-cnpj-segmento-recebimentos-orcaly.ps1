param(
  [switch]$DryRun,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\cpf-cnpj-recebimentos-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  Join-Path $Root ($Path -replace "/", "\")
}

function Read-Text([string]$Path) {
  $Target = Full $Path
  if (-not (Test-Path -LiteralPath $Target)) {
    throw "Arquivo nao encontrado: $Path"
  }
  [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")
}

function Save-Text([string]$Path, [string]$Text) {
  if ($DryRun) {
    Write-Host "[DRY-RUN] $Path" -ForegroundColor Yellow
    return
  }

  $Target = Full $Path
  if (Test-Path -LiteralPath $Target) {
    $Copy = Join-Path $Backup ($Path -replace "/", "\")
    New-Item -ItemType Directory -Force -Path (Split-Path $Copy -Parent) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $Copy -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null
  [IO.File]::WriteAllText($Target, $Text.Trim() + "`n", $Utf8)
  Write-Host "[OK] $Path" -ForegroundColor Green
}

function Replace-Required(
  [string]$Text,
  [string]$Old,
  [string]$New,
  [string]$Label
) {
  if ($Text.Contains($New)) {
    Write-Host "[JA APLICADO] $Label" -ForegroundColor DarkGreen
    return $Text
  }
  if (-not $Text.Contains($Old)) {
    throw "Trecho nao localizado: $Label"
  }
  $Text.Replace($Old, $New)
}

function Replace-Between(
  [string]$Text,
  [string]$Start,
  [string]$End,
  [string]$Replacement,
  [string]$Label
) {
  $StartAt = $Text.IndexOf($Start, [StringComparison]::Ordinal)
  if ($StartAt -lt 0) {
    if ($Text.Contains($Replacement.Trim())) {
      Write-Host "[JA APLICADO] $Label" -ForegroundColor DarkGreen
      return $Text
    }
    throw "Inicio nao localizado: $Label"
  }

  $EndAt = $Text.IndexOf(
    $End,
    $StartAt + $Start.Length,
    [StringComparison]::Ordinal
  )
  if ($EndAt -lt 0) {
    throw "Fim nao localizado: $Label"
  }

  $EndAt += $End.Length
  $Text.Substring(0, $StartAt) + $Replacement + $Text.Substring($EndAt)
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto."
}

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $Backup | Out-Null
}

Write-Host ""
Write-Host "==> Corrigindo CPF, CNPJ e segmento automatico" -ForegroundColor Cyan

# -------------------------------------------------------------------
# API
# -------------------------------------------------------------------
$ApiPath = "app/api/payments/asaas/account/route.ts"
$Api = Read-Text $ApiPath

$Api = Replace-Required $Api @'
const PUBLIC_ACCOUNT_FIELDS =
  "id,provider_account_id,provider_wallet_id,onboarding_status,account_status,charges_enabled,payouts_enabled,card_enabled,pix_enabled,onboarding_url,legal_name,document_last4,bank_name,bank_account_last4,bank_account_type,last_status_check_at,is_active,created_at,updated_at";
'@ @'
const PUBLIC_ACCOUNT_FIELDS =
  "id,provider_account_id,provider_wallet_id,onboarding_status,account_status,charges_enabled,payouts_enabled,card_enabled,pix_enabled,onboarding_url,legal_name,document_last4,bank_name,bank_account_last4,bank_account_type,last_status_check_at,is_active,created_at,updated_at";

const VALID_COMPANY_TYPES = new Set([
  "MEI",
  "LIMITED",
  "INDIVIDUAL",
  "ASSOCIATION",
]);

const BUSINESS_LABELS: Record<string, string> = {
  services: "Servicos gerais",
  graphic: "Grafica e personalizados",
  food: "Alimenticio / Food",
  beauty: "Estetica e beleza",
  barber: "Barbearia",
  technical_assistance: "Assistencia tecnica",
  auto: "Automotivo",
  store: "Loja e varejo",
  events: "Eventos",
  custom_products: "Produtos personalizados",
  real_estate: "Imoveis e imobiliarias",
  imoveis: "Imoveis e imobiliarias",
  imobiliaria: "Imoveis e imobiliarias",
};

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function businessLabel(value: unknown) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!key) return "Segmento ainda nao definido";
  if (BUSINESS_LABELS[key]) return BUSINESS_LABELS[key];

  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
'@ "validadores e segmentos da API"

$Api = Replace-Required $Api @'
    const companyId = String(context.company.id);

    const { data } = await context.supabase
'@ @'
    const companyId = String(context.company.id);
    const businessType = String(
      context.company.business_type ||
        context.company.segment ||
        context.company.tipo_negocio ||
        "",
    ).trim();

    const { data } = await context.supabase
'@ "leitura do segmento"

$Api = Replace-Required $Api @'
      bankName: data?.bank_name || null,
      bankAccountLast4: data?.bank_account_last4 || null,
      capabilities: getAsaasCapabilities(),
'@ @'
      bankName: data?.bank_name || null,
      bankAccountLast4: data?.bank_account_last4 || null,
      businessType: businessType || null,
      businessTypeLabel: businessLabel(businessType),
      suggestedName: String(
        context.company.nome ||
          context.company.name ||
          context.company.razao_social ||
          "",
      ).trim(),
      suggestedEmail: String(context.user.email || "").trim(),
      capabilities: getAsaasCapabilities(),
'@ "retorno do segmento e sugestoes"

$Api = Replace-Required $Api @'
    const body = await request.json();
    const companyId = String(context.company.id);

    const { data: existing } = await context.supabase
'@ @'
    const body = await request.json();
    const companyId = String(context.company.id);
    const document = digits(body.cpfCnpj);
    const isCpf = document.length === 11;
    const isCnpj = document.length === 14;
    const birthDate = String(body.birthDate || "").trim();
    const companyType = String(body.companyType || "")
      .trim()
      .toUpperCase();
    const incomeValue = Number(body.incomeValue || 0);

    if (!isCpf && !isCnpj) {
      throw Object.assign(
        new Error("Informe um CPF com 11 digitos ou um CNPJ com 14 digitos."),
        { status: 400 },
      );
    }

    if (isCpf && !birthDate) {
      throw Object.assign(
        new Error("A data de nascimento e obrigatoria para conta com CPF."),
        { status: 400 },
      );
    }

    if (isCnpj && !VALID_COMPANY_TYPES.has(companyType)) {
      throw Object.assign(
        new Error(
          "Selecione a natureza juridica: MEI, LTDA, Empresario Individual ou Associacao.",
        ),
        { status: 400 },
      );
    }

    if (!Number.isFinite(incomeValue) || incomeValue <= 0) {
      throw Object.assign(
        new Error(
          isCpf
            ? "Informe a renda mensal do titular."
            : "Informe o faturamento mensal da empresa.",
        ),
        { status: 400 },
      );
    }

    const { data: existing } = await context.supabase
'@ "validacao CPF CNPJ"

$Api = Replace-Required $Api @'
      cpfCnpj: String(body.cpfCnpj || "").replace(/\D/g, ""),
      birthDate: String(body.birthDate || "").trim() || undefined,
      companyType: String(body.companyType || "").trim() || undefined,
'@ @'
      cpfCnpj: document,
      birthDate: isCpf ? birthDate : undefined,
      companyType: isCnpj ? companyType : undefined,
'@ "payload condicional"

$Api = Replace-Required $Api @'
      postalCode:
        String(body.postalCode || "").replace(/\D/g, "") || undefined,
      incomeValue: Number(body.incomeValue || 0) || undefined,
'@ @'
      postalCode: digits(body.postalCode) || undefined,
      incomeValue,
'@ "renda e faturamento"

Save-Text $ApiPath $Api

# -------------------------------------------------------------------
# PAINEL
# -------------------------------------------------------------------
$PanelPath = "components/payments/AsaasFinancialPanel.tsx"
$Panel = Read-Text $PanelPath

$Panel = Replace-Required $Panel @'
  bankAccountLast4?: string;
};
'@ @'
  bankAccountLast4?: string;
  businessType?: string | null;
  businessTypeLabel?: string | null;
  suggestedName?: string | null;
  suggestedEmail?: string | null;
};
'@ "tipo Account"

$Panel = Replace-Required $Panel @'
type IconName =
'@ @'
const ASAAS_COMPANY_TYPES = [
  { value: "MEI", label: "Microempreendedor Individual (MEI)" },
  { value: "LIMITED", label: "Sociedade Limitada (LTDA)" },
  { value: "INDIVIDUAL", label: "Empresario Individual (EI)" },
  { value: "ASSOCIATION", label: "Associacao" },
] as const;

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function documentType(value: unknown) {
  const document = onlyDigits(value);
  if (document.length === 11) return "CPF";
  if (document.length === 14) return "CNPJ";
  return null;
}

function formatCpfCnpj(value: unknown) {
  const document = onlyDigits(value).slice(0, 14);

  if (document.length <= 11) {
    return document
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return document
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

type IconName =
'@ "helpers do formulario"

$Panel = Replace-Required $Panel @'
  function applyDashboard(payload: Dashboard) {
    setAccount(payload.account);
    setPayoutKey(payload.payoutKey);
    setTransactions(payload.transactions);
    setPayouts(payload.payouts);
  }
'@ @'
  function applyDashboard(payload: Dashboard) {
    setAccount(payload.account);
    setPayoutKey(payload.payoutKey);
    setTransactions(payload.transactions);
    setPayouts(payload.payouts);

    if (!payload.account.configured) {
      setAccountForm((current) => ({
        ...current,
        name: current.name || payload.account.suggestedName || "",
        email: current.email || payload.account.suggestedEmail || "",
      }));
    }
  }
'@ "preenchimento de nome e email"

$Panel = Replace-Required $Panel @'
  const [pixForm, setPixForm] = useState({
    type: "CPF",
    key: "",
    automaticPayoutEnabled: true,
    minimumPayoutAmount: "0",
  });
'@ @'
  const [pixForm, setPixForm] = useState({
    type: "CPF",
    key: "",
    automaticPayoutEnabled: true,
    minimumPayoutAmount: "0",
  });

  const currentDocumentType = documentType(accountForm.cpfCnpj);
'@ "deteccao do documento"

$CreateAccount = @'
  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const document = onlyDigits(accountForm.cpfCnpj);
    const type = documentType(document);
    const incomeValue = Number(accountForm.incomeValue || 0);

    setError("");
    setMessage("");

    if (!type) {
      setError("Informe um CPF com 11 digitos ou um CNPJ com 14 digitos.");
      return;
    }

    if (type === "CPF" && !accountForm.birthDate) {
      setError("Informe a data de nascimento do titular.");
      return;
    }

    if (type === "CNPJ" && !accountForm.companyType) {
      setError("Selecione a natureza juridica da empresa.");
      return;
    }

    if (!Number.isFinite(incomeValue) || incomeValue <= 0) {
      setError(
        type === "CPF"
          ? "Informe a renda mensal do titular."
          : "Informe o faturamento mensal da empresa.",
      );
      return;
    }

    setSaving(true);
    setMessage("Criando sua conta de recebimento em ambiente seguro...");

    try {
      await api("/api/payments/asaas/account", {
        method: "POST",
        body: JSON.stringify({
          ...accountForm,
          cpfCnpj: document,
          birthDate:
            type === "CPF" ? accountForm.birthDate : undefined,
          companyType:
            type === "CNPJ" ? accountForm.companyType : undefined,
          incomeValue,
        }),
      });

      setMessage(
        "Conta criada. Conclua a verificacao cadastral para liberar os recebimentos.",
      );
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Nao foi possivel criar a conta.",
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

'@

$Panel = Replace-Between `
  $Panel `
  '  async function createAccount(event: FormEvent<HTMLFormElement>) {' `
  '  async function refreshAccountStatus() {' `
  ($CreateAccount + '  async function refreshAccountStatus() {') `
  "submit da conta"

$Panel = Replace-Required $Panel @'
                    ["cpfCnpj", "CPF ou CNPJ", "text"],
                    ["birthDate", "Data de nascimento", "date"],
                    ["companyType", "Tipo de empresa", "text"],
'@ @'
                    ["cpfCnpj", "CPF ou CNPJ", "document"],
                    ["birthDate", "Data de nascimento (somente CPF)", "date"],
                    [
                      "companyType",
                      "Natureza juridica (somente CNPJ)",
                      "companyType",
                    ],
'@ "campos CPF CNPJ"

$Panel = Replace-Required $Panel @'
                <div className="mt-7 grid gap-5 md:grid-cols-2">
                  {[
'@ @'
                <div className="mt-7 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-600">
                    Segmento cadastrado no Orcaly
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-950">
                    {account.businessTypeLabel || "Segmento ainda nao definido"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    O segmento e carregado automaticamente. A natureza juridica
                    continua separada porque depende do CNPJ da empresa.
                  </p>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {[
'@ "segmento automatico"

$OldInput = @'
                      <input
                        type={type}
                        value={
                          accountForm[name as keyof typeof accountForm]
                        }
                        onChange={(event) =>
                          setAccountForm((current) => ({
                            ...current,
                            [name]: event.target.value,
                          }))
                        }
                        required={[
                          "name",
                          "email",
                          "cpfCnpj",
                          "postalCode",
                          "address",
                          "addressNumber",
                        ].includes(name)}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                      />
'@

$NewInput = @'
                      {type === "companyType" ? (
                        <select
                          value={accountForm.companyType}
                          onChange={(event) =>
                            setAccountForm((current) => ({
                              ...current,
                              companyType: event.target.value,
                            }))
                          }
                          required={currentDocumentType === "CNPJ"}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                        >
                          <option value="">Selecione</option>
                          {ASAAS_COMPANY_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={type === "document" ? "text" : type}
                          inputMode={
                            type === "document" ||
                            name === "postalCode" ||
                            type === "number"
                              ? "numeric"
                              : undefined
                          }
                          maxLength={type === "document" ? 18 : undefined}
                          value={
                            type === "document"
                              ? formatCpfCnpj(accountForm.cpfCnpj)
                              : accountForm[
                                  name as keyof typeof accountForm
                                ]
                          }
                          onChange={(event) =>
                            setAccountForm((current) => ({
                              ...current,
                              [name]:
                                type === "document"
                                  ? formatCpfCnpj(event.target.value)
                                  : event.target.value,
                            }))
                          }
                          required={
                            [
                              "name",
                              "email",
                              "cpfCnpj",
                              "postalCode",
                              "address",
                              "addressNumber",
                              "incomeValue",
                            ].includes(name) ||
                            (name === "birthDate" &&
                              currentDocumentType === "CPF")
                          }
                          min={type === "number" ? "0.01" : undefined}
                          step={type === "number" ? "0.01" : undefined}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                        />
                      )}
'@

$Panel = Replace-Required $Panel $OldInput $NewInput "select de natureza juridica"

Save-Text $PanelPath $Panel

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan
  & npm.cmd run build
  $Code = $LASTEXITCODE
  Write-Host "BUILD_EXIT_CODE=$Code"
  if ($Code -ne 0) {
    Write-Host "Build falhou. Backup: $Backup" -ForegroundColor Red
    exit $Code
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "RECEBIMENTOS ATUALIZADOS" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "CPF: permitido, com data de nascimento"
Write-Host "CNPJ: permitido, com natureza juridica valida"
Write-Host "Segmento: automatico pelo cadastro da empresa"
Write-Host "Campo livre 'tipo de empresa': removido"
Write-Host "Backup: $Backup"
