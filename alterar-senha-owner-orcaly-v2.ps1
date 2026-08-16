param(
    [string]$ProjectRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$OwnerEmail = "viniciusadm@orcaly.com"
$TempJs = $null
$EnvBackup = @{}

function Backup-Env([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ($null -ne $value) {
        $script:EnvBackup[$Name] = $value
    }
}

function Restore-Env([string]$Name) {
    if ($script:EnvBackup.ContainsKey($Name)) {
        [Environment]::SetEnvironmentVariable(
            $Name,
            [string]$script:EnvBackup[$Name],
            "Process"
        )
    } else {
        [Environment]::SetEnvironmentVariable(
            $Name,
            $null,
            "Process"
        )
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "package.json") -PathType Leaf)) {
    throw "Execute este script na raiz do projeto Orçaly."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules") -PathType Container)) {
    throw "node_modules não encontrado. Execute 'npm install' antes."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules\@supabase\supabase-js") -PathType Container)) {
    throw "@supabase/supabase-js não foi encontrado em node_modules."
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    throw "Node.js não foi encontrado."
}

Write-Host ""
Write-Host "ORÇALY - ALTERAR SENHA DO OWNER - V2" -ForegroundColor Cyan
Write-Host ("Conta: " + $OwnerEmail) -ForegroundColor DarkCyan
Write-Host ""

$securePassword = Read-Host "Digite a nova senha" -AsSecureString
$ptr = [IntPtr]::Zero

try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)

    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw "A senha não pode estar vazia."
    }

    if ($plainPassword.Length -lt 8) {
        throw "A senha precisa ter pelo menos 8 caracteres."
    }

    Backup-Env "ORCALY_OWNER_NEW_PASSWORD"
    [Environment]::SetEnvironmentVariable(
        "ORCALY_OWNER_NEW_PASSWORD",
        $plainPassword,
        "Process"
    )

    # IMPORTANTE:
    # O arquivo temporário fica DENTRO da raiz do projeto.
    # Assim require("@next/env") e require("@supabase/supabase-js")
    # resolvem pelo node_modules do próprio Orçaly.
    $TempJs = Join-Path $ProjectRoot (
        ".orcaly-reset-owner-" +
        [guid]::NewGuid().ToString("N") +
        ".cjs"
    )

    $js = @'
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.ORCALY_OWNER_NEW_PASSWORD;
const targetEmail = "viniciusadm@orcaly.com";

if (!url) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL não encontrada em .env/.env.local."
  );
}

if (!serviceRole) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY não encontrada em .env/.env.local."
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
    const { data, error } =
      await supabase.auth.admin.listUsers({
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

    if (users.length < 100) {
      break;
    }
  }

  return null;
}

(async () => {
  const user = await findUserByEmail();

  if (!user?.id) {
    throw new Error(
      "Conta viniciusadm@orcaly.com não encontrada no Supabase Auth."
    );
  }

  console.log(
    "[OK] Conta owner localizada no Supabase Auth."
  );

  const { data, error } =
    await supabase.auth.admin.updateUserById(
      user.id,
      { password }
    );

  if (error) {
    throw error;
  }

  if (!data?.user?.id) {
    throw new Error(
      "Supabase não confirmou a atualização da conta."
    );
  }

  console.log(
    "[OK] Senha atualizada pelo Supabase Auth Admin."
  );

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
      "[AVISO] A senha foi alterada, mas não foi possível atualizar must_change_password:",
      adminError.message
    );
  } else {
    console.log(
      "[OK] Flag de troca obrigatória de senha desativada."
    );
  }

  console.log(
    "[OK] Owner:",
    targetEmail
  );
})().catch((error) => {
  console.error(
    "[ERRO]",
    error?.message || error
  );
  process.exit(1);
});
'@

    [IO.File]::WriteAllText(
        $TempJs,
        $js,
        (New-Object System.Text.UTF8Encoding($false))
    )

    Push-Location $ProjectRoot

    try {
        node.exe $TempJs
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($exitCode -ne 0) {
        throw "A alteração da senha falhou."
    }
}
finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }

    Restore-Env "ORCALY_OWNER_NEW_PASSWORD"

    if (
        $TempJs -and
        (Test-Path -LiteralPath $TempJs -PathType Leaf)
    ) {
        Remove-Item -LiteralPath $TempJs -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Senha do owner atualizada com sucesso." -ForegroundColor Green
Write-Host "Nenhuma chave do Supabase foi exibida." -ForegroundColor DarkGray
