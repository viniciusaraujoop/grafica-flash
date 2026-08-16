param(
    [string]$ProjectRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$OwnerEmail = "viniciusadm@orcaly.com"

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    throw "Node.js não foi encontrado."
}

Write-Host ""
Write-Host "ORÇALY - ALTERAR SENHA DO OWNER" -ForegroundColor Cyan
Write-Host "Conta: $OwnerEmail" -ForegroundColor DarkCyan
Write-Host ""

$securePassword = Read-Host "Digite a nova senha" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)

    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw "A senha não pode estar vazia."
    }

    $env:ORCALY_OWNER_NEW_PASSWORD = $plainPassword

    $tempJs = Join-Path $env:TEMP ("orcaly-reset-owner-" + [guid]::NewGuid().ToString("N") + ".cjs")

    $js = @'
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.ORCALY_OWNER_NEW_PASSWORD;
const targetEmail = "viniciusadm@orcaly.com";

if (!url) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL não encontrada.");
}

if (!serviceRole) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY não encontrada em .env.local/.env do projeto."
  );
}

if (!password) {
  throw new Error("Nova senha não recebida.");
}

const supabase = createClient(url, serviceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail() {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) throw error;

    const users = data?.users || [];
    const found = users.find(
      (user) =>
        String(user.email || "").toLowerCase() ===
        targetEmail.toLowerCase()
    );

    if (found) return found;
    if (users.length < 100) break;
  }

  return null;
}

(async () => {
  const user = await findUserByEmail();

  if (!user?.id) {
    throw new Error("Conta owner não encontrada no Supabase Auth.");
  }

  const { data, error } =
    await supabase.auth.admin.updateUserById(user.id, {
      password,
    });

  if (error) throw error;

  if (!data?.user?.id) {
    throw new Error("Supabase não confirmou a atualização da conta.");
  }

  const { error: adminError } = await supabase
    .from("platform_admins")
    .update({
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .ilike("email", targetEmail);

  if (adminError) {
    console.warn(
      "[AVISO] Senha alterada, mas não foi possível atualizar must_change_password:",
      adminError.message
    );
  }

  console.log("[OK] Senha da conta owner alterada no Supabase Auth.");
  console.log("[OK] Usuário:", targetEmail);
})().catch((error) => {
  console.error("[ERRO]", error?.message || error);
  process.exit(1);
});
'@

    [IO.File]::WriteAllText(
        $tempJs,
        $js,
        (New-Object System.Text.UTF8Encoding($false))
    )

    Push-Location $ProjectRoot

    try {
        node.exe $tempJs

        if ($LASTEXITCODE -ne 0) {
            throw "A alteração da senha falhou."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }

    Remove-Item Env:\ORCALY_OWNER_NEW_PASSWORD -ErrorAction SilentlyContinue

    if ($tempJs -and (Test-Path -LiteralPath $tempJs)) {
        Remove-Item -LiteralPath $tempJs -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Senha atualizada com sucesso." -ForegroundColor Green
