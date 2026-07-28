param(
  [switch]$DryRun,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\cpf-cnpj-segmento-v2-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  return Join-Path $Root ($Path -replace "/", "\")
}

function Read-Text([string]$Path) {
  $Target = Full $Path

  if (-not (Test-Path -LiteralPath $Target)) {
    throw "Arquivo nao encontrado: $Path"
  }

  return [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")
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

function Replace-Exact(
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

  return $Text.Replace($Old, $New)
}

function Insert-After(
  [string]$Text,
  [string]$Marker,
  [string]$Insertion,
  [string]$AlreadyMarker,
  [string]$Label
) {
  if ($AlreadyMarker -and $Text.Contains($AlreadyMarker)) {
    Write-Host "[JA APLICADO] $Label" -ForegroundColor DarkGreen
    return $Text
  }

  $Index = $Text.IndexOf($Marker, [StringComparison]::Ordinal)
  if ($Index -lt 0) {
    throw "Marcador nao localizado: $Label"
  }

  $End = $Index + $Marker.Length
  return $Text.Substring(0, $End) + $Insertion + $Text.Substring($End)
}

function Replace-Between(
  [string]$Text,
  [string]$StartMarker,
  [string]$EndMarker,
  [string]$Replacement,
  [string]$AlreadyMarker,
  [string]$Label,
  [int]$SearchFrom = 0
) {
  if ($AlreadyMarker -and $Text.Contains($AlreadyMarker)) {
    Write-Host "[JA APLICADO] $Label" -ForegroundColor DarkGreen
    return $Text
  }

  $Start = $Text.IndexOf(
    $StartMarker,
    $SearchFrom,
    [StringComparison]::Ordinal
  )

  if ($Start -lt 0) {
    throw "Inicio nao localizado: $Label"
  }

  $End = $Text.IndexOf(
    $EndMarker,
    $Start + $StartMarker.Length,
    [StringComparison]::Ordinal
  )

  if ($End -lt 0) {
    throw "Fim nao localizado: $Label"
  }

  return $Text.Substring(0, $Start) +
    $Replacement +
    $Text.Substring($End)
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto."
}

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $Backup | Out-Null
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - CPF/CNPJ E SEGMENTO AUTOMATICO V2" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# ================================================================
# API
# ================================================================
$ApiPath = "app/api/payments/asaas/account/route.ts"
$Api = Read-Text $ApiPath

$PublicFieldsStart = 'const PUBLIC_ACCOUNT_FIELDS ='
if (-not $Api.Contains("const VALID_COMPANY_TYPES")) {
  $FieldsAt = $Api.IndexOf($PublicFieldsStart, [StringComparison]::Ordinal)
  if ($FieldsAt -lt 0) {
    throw "PUBLIC_ACCOUNT_FIELDS nao foi localizado."
  }

  $FieldsEnd = $Api.IndexOf(";", $FieldsAt, [StringComparison]::Ordinal)
  if ($FieldsEnd -lt 0) {
    throw "Fim de PUBLIC_ACCOUNT_FIELDS nao foi localizado."
  }

  $FieldsEnd += 1

  $ApiHelpers = @'

const VALID_COMPANY_TYPES = new Set([
  "MEI",
  "LIMITED",
  "INDIVIDUAL",
  "ASSOCIATION",
]);

const BUSINESS_LABELS: Record<string, string> = {
  services: "Servicos gerais",
  servicos: "Servicos gerais",
  graphic: "Grafica e personalizados",
  grafica: "Grafica e personalizados",
  food: "Alimenticio / Food",
  alimenticio: "Alimenticio / Food",
  restaurante: "Alimenticio / Food",
  lanchonete: "Alimenticio / Food",
  beauty: "Estetica e beleza",
  beleza: "Estetica e beleza",
  barber: "Barbearia",
  barbearia: "Barbearia",
  technical_assistance: "Assistencia tecnica",
  assistencia_tecnica: "Assistencia tecnica",
  auto: "Automotivo",
  automotivo: "Automotivo",
  oficina: "Automotivo",
  store: "Loja e varejo",
  loja: "Loja e varejo",
  varejo: "Loja e varejo",
  events: "Eventos",
  eventos: "Eventos",
  custom_products: "Produtos personalizados",
  personalizados: "Produtos personalizados",
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
'@

  $Api =
    $Api.Substring(0, $FieldsEnd) +
    $ApiHelpers +
    $Api.Substring($FieldsEnd)

  Write-Host "[PREPARADO] validadores da API" -ForegroundColor Cyan
} else {
  Write-Host "[JA APLICADO] validadores da API" -ForegroundColor DarkGreen
}

$GetStart = $Api.IndexOf(
  "export async function GET",
  [StringComparison]::Ordinal
)
$PostStart = $Api.IndexOf(
  "export async function POST",
  [StringComparison]::Ordinal
)

if ($GetStart -lt 0 -or $PostStart -lt 0) {
  throw "Funcoes GET ou POST da conta nao foram localizadas."
}

$GetSection = $Api.Substring($GetStart, $PostStart - $GetStart)

if (-not $GetSection.Contains("const businessType = String(")) {
  $CompanyMarker = '    const companyId = String(context.company.id);'
  $CompanyAt = $Api.IndexOf(
    $CompanyMarker,
    $GetStart,
    [StringComparison]::Ordinal
  )

  if ($CompanyAt -lt 0 -or $CompanyAt -ge $PostStart) {
    throw "companyId do GET nao foi localizado."
  }

  $InsertAt = $CompanyAt + $CompanyMarker.Length
  $BusinessTypeCode = @'

    const businessType = String(
      context.company.business_type ||
        context.company.segment ||
        context.company.tipo_negocio ||
        "",
    ).trim();
'@

  $Api =
    $Api.Substring(0, $InsertAt) +
    $BusinessTypeCode +
    $Api.Substring($InsertAt)

  Write-Host "[PREPARADO] segmento no GET" -ForegroundColor Cyan
} else {
  Write-Host "[JA APLICADO] segmento no GET" -ForegroundColor DarkGreen
}

if (-not $Api.Contains("businessTypeLabel: businessLabel(businessType)")) {
  $CapabilitiesMarker = '      capabilities: getAsaasCapabilities(),'
  $CapabilitiesAt = $Api.IndexOf(
    $CapabilitiesMarker,
    $GetStart,
    [StringComparison]::Ordinal
  )

  $PostStart = $Api.IndexOf(
    "export async function POST",
    [StringComparison]::Ordinal
  )

  if ($CapabilitiesAt -lt 0 -or $CapabilitiesAt -ge $PostStart) {
    throw "Retorno capabilities do GET nao foi localizado."
  }

  $GetExtra = @'
      businessType: businessType || null,
      businessTypeLabel: businessLabel(businessType),
      suggestedName: String(
        context.company.nome ||
          context.company.name ||
          context.company.razao_social ||
          "",
      ).trim(),
      suggestedEmail: String(context.user.email || "").trim(),
'@

  $Api =
    $Api.Substring(0, $CapabilitiesAt) +
    $GetExtra +
    $Api.Substring($CapabilitiesAt)

  Write-Host "[PREPARADO] retorno do segmento e sugestoes" -ForegroundColor Cyan
} else {
  Write-Host "[JA APLICADO] retorno do segmento e sugestoes" -ForegroundColor DarkGreen
}

$PostValidationMarker = @'
    const body = await request.json();
    const companyId = String(context.company.id);
'@

if (-not $Api.Contains("const document = digits(body.cpfCnpj);")) {
  $ValidationCode = @'
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
'@

  $Api = Replace-Exact `
    $Api `
    $PostValidationMarker `
    $ValidationCode `
    "validacao CPF e CNPJ"
} else {
  Write-Host "[JA APLICADO] validacao CPF e CNPJ" -ForegroundColor DarkGreen
}

$Api = Replace-Exact $Api @'
      cpfCnpj: String(body.cpfCnpj || "").replace(/\D/g, ""),
      birthDate: String(body.birthDate || "").trim() || undefined,
      companyType: String(body.companyType || "").trim() || undefined,
'@ @'
      cpfCnpj: document,
      birthDate: isCpf ? birthDate : undefined,
      companyType: isCnpj ? companyType : undefined,
'@ "payload condicional CPF CNPJ"

$Api = Replace-Exact $Api @'
      postalCode:
        String(body.postalCode || "").replace(/\D/g, "") || undefined,
      incomeValue: Number(body.incomeValue || 0) || undefined,
'@ @'
      postalCode: digits(body.postalCode) || undefined,
      incomeValue,
'@ "renda e faturamento"

Save-Text $ApiPath $Api

# ================================================================
# PAINEL
# ================================================================
$PanelPath = "components/payments/AsaasFinancialPanel.tsx"
$Panel = Read-Text $PanelPath

$Panel = Replace-Exact $Panel @'
  bankAccountLast4?: string;
};
'@ @'
  bankAccountLast4?: string;
  businessType?: string | null;
  businessTypeLabel?: string | null;
  suggestedName?: string | null;
  suggestedEmail?: string | null;
};
'@ "campos do segmento no painel"

$PanelHelpers = @'
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

'@

$Panel = Insert-After `
  $Panel `
  "type Tab =`n  | `"overview`"`n  | `"account`"`n  | `"pix`"`n  | `"transactions`"`n  | `"payouts`";`n`n" `
  $PanelHelpers `
  "const ASAAS_COMPANY_TYPES" `
  "helpers do formulario"

$Panel = Replace-Exact $Panel @'
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
'@ "preenchimento automatico de nome e email"

$Panel = Replace-Exact $Panel @'
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
'@ "deteccao automatica do documento"

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
  'const document = onlyDigits(accountForm.cpfCnpj);' `
  'envio condicional CPF CNPJ'

$AccountTitle = "Configure sua conta de recebimento"
$AccountTitleAt = $Panel.IndexOf(
  $AccountTitle,
  [StringComparison]::Ordinal
)

if ($AccountTitleAt -lt 0) {
  throw "Formulario da conta de recebimento nao foi localizado."
}

if (-not $Panel.Contains("Segmento cadastrado no Orcaly")) {
  $FormStartMarker =
    '                <div className="mt-7 grid gap-5 md:grid-cols-2">'
  $FormEndMarker =
    '                <div className="mt-7 flex flex-wrap items-center gap-4">'

  $FormStart = $Panel.IndexOf(
    $FormStartMarker,
    $AccountTitleAt,
    [StringComparison]::Ordinal
  )

  $FormEnd = $Panel.IndexOf(
    $FormEndMarker,
    $FormStart + $FormStartMarker.Length,
    [StringComparison]::Ordinal
  )

  if ($FormStart -lt 0 -or $FormEnd -lt 0) {
    throw "Bloco dos campos da conta nao foi localizado."
  }

  $NewForm = @'
                <div className="mt-7 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-600">
                    Segmento cadastrado no Orcaly
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-950">
                    {account.businessTypeLabel || "Segmento ainda nao definido"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    O segmento vem automaticamente do cadastro da empresa. A
                    natureza juridica e informada separadamente apenas para CNPJ.
                  </p>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    Nome completo ou razao social
                    <input
                      type="text"
                      value={accountForm.name}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    E-mail
                    <input
                      type="email"
                      value={accountForm.email}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      required
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    CPF ou CNPJ
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={18}
                      value={formatCpfCnpj(accountForm.cpfCnpj)}
                      onChange={(event) => {
                        const cpfCnpj = formatCpfCnpj(event.target.value);
                        const nextType = documentType(cpfCnpj);

                        setAccountForm((current) => ({
                          ...current,
                          cpfCnpj,
                          birthDate:
                            nextType === "CNPJ"
                              ? ""
                              : current.birthDate,
                          companyType:
                            nextType === "CPF"
                              ? ""
                              : current.companyType,
                        }));
                      }}
                      required
                      placeholder="Digite o CPF ou CNPJ"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                    <span className="mt-1.5 block text-xs font-normal text-slate-500">
                      {currentDocumentType === "CPF"
                        ? "Cadastro identificado como pessoa fisica."
                        : currentDocumentType === "CNPJ"
                          ? "Cadastro identificado como pessoa juridica."
                          : "O tipo e identificado automaticamente pelo documento."}
                    </span>
                  </label>

                  {currentDocumentType === "CPF" ? (
                    <label className="min-w-0 text-sm font-bold text-slate-700">
                      Data de nascimento
                      <input
                        type="date"
                        value={accountForm.birthDate}
                        onChange={(event) =>
                          setAccountForm((current) => ({
                            ...current,
                            birthDate: event.target.value,
                          }))
                        }
                        required
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                      />
                    </label>
                  ) : currentDocumentType === "CNPJ" ? (
                    <label className="min-w-0 text-sm font-bold text-slate-700">
                      Natureza juridica
                      <select
                        value={accountForm.companyType}
                        onChange={(event) =>
                          setAccountForm((current) => ({
                            ...current,
                            companyType: event.target.value,
                          }))
                        }
                        required
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                      >
                        <option value="">Selecione</option>
                        {ASAAS_COMPANY_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                      Digite o documento completo para exibir os dados
                      obrigatorios do titular.
                    </div>
                  )}

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    Telefone
                    <input
                      type="tel"
                      value={accountForm.phone}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    Celular
                    <input
                      type="tel"
                      value={accountForm.mobilePhone}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          mobilePhone: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    CEP
                    <input
                      type="text"
                      inputMode="numeric"
                      value={accountForm.postalCode}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          postalCode: event.target.value,
                        }))
                      }
                      required
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    Endereco
                    <input
                      type="text"
                      value={accountForm.address}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      required
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    Numero
                    <input
                      type="text"
                      value={accountForm.addressNumber}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          addressNumber: event.target.value,
                        }))
                      }
                      required
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    Complemento
                    <input
                      type="text"
                      value={accountForm.complement}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          complement: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    Bairro
                    <input
                      type="text"
                      value={accountForm.province}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          province: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="min-w-0 text-sm font-bold text-slate-700">
                    {currentDocumentType === "CPF"
                      ? "Renda mensal"
                      : "Faturamento mensal"}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={accountForm.incomeValue}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          incomeValue: event.target.value,
                        }))
                      }
                      required
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>
                </div>

'@

  $Panel =
    $Panel.Substring(0, $FormStart) +
    $NewForm +
    $Panel.Substring($FormEnd)

  Write-Host "[PREPARADO] formulario CPF CNPJ e segmento" -ForegroundColor Cyan
} else {
  Write-Host "[JA APLICADO] formulario CPF CNPJ e segmento" -ForegroundColor DarkGreen
}

Save-Text $PanelPath $Panel

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan
  & npm.cmd run build
  $Code = $LASTEXITCODE
  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    Write-Host "O build falhou. Backup: $Backup" -ForegroundColor Red
    exit $Code
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "CADASTRO DE RECEBIMENTO ATUALIZADO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "CPF: data de nascimento e renda mensal"
Write-Host "CNPJ: natureza juridica e faturamento mensal"
Write-Host "Segmento: automatico pelo cadastro da empresa"
Write-Host "Campo livre de tipo de empresa: removido"
Write-Host "Backup: $Backup"
