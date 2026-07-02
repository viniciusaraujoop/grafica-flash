$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "components\public-site\PublicSiteRenderer.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-benefits-types-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# Remove acessos a aliases em objetos vindos do template tipado, que o TypeScript não aceita.
# Normaliza para um formato único antes de renderizar. Sim, o compilador resolveu implicar com "titulo".
$helpers = @'
function normalizeTextItems(
  value: unknown,
  fallback: Array<{ title: string; text: string }>
): Array<{ title: string; text: string }> {
  const custom = asArray<TextItem>(value)
    .map((item) => ({
      title: item.title || item.titulo || '',
      text: item.text || item.texto || '',
    }))
    .filter((item) => item.title || item.text)

  return custom.length ? custom : fallback
}

function normalizeFaqItems(
  value: unknown,
  fallback: Array<{ question: string; answer: string }>
): Array<{ question: string; answer: string }> {
  const custom = asArray<FaqItem>(value)
    .map((item) => ({
      question: item.question || item.pergunta || '',
      answer: item.answer || item.resposta || '',
    }))
    .filter((item) => item.question || item.answer)

  return custom.length ? custom : fallback
}

function normalizeTestimonials(
  value: unknown
): Array<{ name: string; text: string }> {
  return asArray<{ name?: string; nome?: string; text?: string; texto?: string }>(value)
    .map((item) => ({
      name: item.name || item.nome || 'Cliente',
      text: item.text || item.texto || 'Atendimento excelente e organizado.',
    }))
    .filter((item) => item.name || item.text)
}
'@

if ($content -notmatch "function normalizeTextItems") {
  $needle = "function money(value?: number | string | null) {"
  if (!$content.Contains($needle)) {
    Write-Host "Ponto de insercao nao encontrado: function money" -ForegroundColor Red
    exit 1
  }
  $content = $content.Replace($needle, $helpers + "`r`n" + $needle)
}

$content = $content.Replace(
"  const benefits = asArray<TextItem>(company.site_benefits).length ? asArray<TextItem>(company.site_benefits) : template.benefits",
"  const benefits = normalizeTextItems(company.site_benefits, template.benefits)"
)

$content = $content.Replace(
"  const faq = asArray<FaqItem>(company.site_faq).length ? asArray<FaqItem>(company.site_faq) : template.faq",
"  const faq = normalizeFaqItems(company.site_faq, template.faq)"
)

$content = $content.Replace(
"  const testimonials = asArray<{ name?: string; nome?: string; text?: string; texto?: string }>(company.site_testimonials)",
"  const testimonials = normalizeTestimonials(company.site_testimonials)"
)

# Trocas finais no render para usar formato normalizado.
$content = $content.Replace('${benefit.title || benefit.titulo}-${index}', '${benefit.title}-${index}')
$content = $content.Replace('{benefit.title || benefit.titulo}', '{benefit.title}')
$content = $content.Replace('{benefit.text || benefit.texto}', '{benefit.text}')

$content = $content.Replace('${item.question || item.pergunta}-${index}', '${item.question}-${index}')
$content = $content.Replace('{item.question || item.pergunta}', '{item.question}')
$content = $content.Replace('{item.answer || item.resposta}', '{item.answer}')

$content = $content.Replace('${item.name || item.nome}-${index}', '${item.name}-${index}')
$content = $content.Replace('“{item.text || item.texto || ''Atendimento excelente e organizado.''}”', '“{item.text}”')
$content = $content.Replace('{item.name || item.nome || ''Cliente''}', '{item.name}')

if ($content -eq $original) {
  Write-Host "Nenhuma alteracao aplicada. Talvez o arquivo ja esteja corrigido ou diferente do esperado." -ForegroundColor Yellow
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "PublicSiteRenderer corrigido: benefits/faq/testimonials normalizados." -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
