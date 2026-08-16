import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const PATCHER_VERSION = "v3-eof-safe";
const changed = [];
const created = [];

function abs(file) {
  return path.join(root, ...file.split("/"));
}
function read(file) {
  return fs.readFileSync(abs(file), "utf8").replace(/\r\n/g, "\n");
}
function write(file, content) {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
  fs.writeFileSync(abs(file), content.replace(/\r\n/g, "\n"), "utf8");
}
function mustExist(file) {
  if (!fs.existsSync(abs(file))) throw new Error(`Arquivo esperado não encontrado: ${file}`);
}
function replaceOnceText(content, oldText, newText, label) {
  if (content.includes(newText)) return content;
  const first = content.indexOf(oldText);
  if (first < 0) throw new Error(`Trecho não encontrado (${label})`);
  if (content.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`Trecho apareceu mais de uma vez (${label})`);
  }
  return content.slice(0, first) + newText + content.slice(first + oldText.length);
}
function replaceOnceRegex(content, regex, replacement, label) {
  if (!regex.global) {
    const matches = content.match(new RegExp(regex.source, regex.flags + "g"));
    if (!matches?.length) throw new Error(`Padrão não encontrado (${label})`);
    if (matches.length !== 1) throw new Error(`Padrão encontrou ${matches.length} ocorrências (${label})`);
  }
  return content.replace(regex, replacement);
}
function patch(file, transform) {
  mustExist(file);
  const before = read(file);
  const after = transform(before);
  if (after !== before) {
    write(file, after);
    changed.push(file);
    console.log(`[PATCH] ${file}`);
  } else {
    console.log(`[OK] ${file} já estava compatível`);
  }
}
function createOrReplace(file, content) {
  const existed = fs.existsSync(abs(file));
  const before = existed ? read(file) : null;
  if (before !== content) {
    write(file, content);
    (existed ? changed : created).push(file);
    console.log(`[WRITE] ${file}`);
  }
}
function addImportAfter(content, anchor, importLine, label) {
  if (content.includes(importLine)) return content;
  return replaceOnceText(content, anchor, `${anchor}${importLine}\n`, label);
}

// 1) Documento brasileiro canônico
createOrReplace("lib/br-document.ts", `export function documentDigits(value: unknown) {
  return String(value || "").replace(/\\D/g, "");
}

function allEqual(value: string) {
  return /^(\\d)\\1+$/.test(value);
}

export function isValidCpf(value: unknown) {
  const cpf = documentDigits(value);
  if (cpf.length !== 11 || allEqual(cpf)) return false;

  const digit = (baseLength: number) => {
    let sum = 0;
    for (let index = 0; index < baseLength; index += 1) {
      sum += Number(cpf[index]) * (baseLength + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidCnpj(value: unknown) {
  const cnpj = documentDigits(value);
  if (cnpj.length !== 14 || allEqual(cnpj)) return false;

  const calculate = (baseLength: 12 | 13) => {
    const weights =
      baseLength === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce(
      (total, weight, index) => total + Number(cnpj[index]) * weight,
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return (
    calculate(12) === Number(cnpj[12]) &&
    calculate(13) === Number(cnpj[13])
  );
}

export function isValidCpfCnpj(value: unknown) {
  const clean = documentDigits(value);
  return clean.length === 11 ? isValidCpf(clean) : isValidCnpj(clean);
}

export function requireValidCpfCnpj(value: unknown) {
  const clean = documentDigits(value);
  if (!isValidCpfCnpj(clean)) {
    throw new Error("CPF ou CNPJ inválido.");
  }
  return clean;
}
`);

// 1.1) Admin da plataforma depende do cadastro no banco, não de e-mail fixo no código.
patch("proxy.ts", (content) => {
  content = content.replace(
    `      const ownerEmailMatches =
        databaseRole !== 'owner' ||
        String(user.email || '').toLowerCase() ===
          'viniciusadm@orcaly.com'

`,
    "",
  );
  content = content.replace(
    `        !allowedAdminRoles.has(databaseRole) ||
        !ownerEmailMatches`,
    `        !allowedAdminRoles.has(databaseRole)`,
  );

  if (content.includes('viniciusadm@orcaly.com')) {
    throw new Error('proxy ainda contem owner administrativo fixo por e-mail');
  }
  return content;
});

// 2) Autorização e assinatura central
patch("lib/company-access.ts", (content) => {
  content = addImportAfter(
    content,
    "import { NextRequest } from 'next/server'\n",
    "import { getCompanySubscriptionAccess, type SubscriptionAccessInput } from '@/lib/subscription-access'",
    "company-access import assinatura",
  );
  content = addImportAfter(
    content,
    "import { getCompanySubscriptionAccess, type SubscriptionAccessInput } from '@/lib/subscription-access'\n",
    "import { normalizePlanKey, type PlanKey } from '@/lib/plans/plan-config'",
    "company-access import plano",
  );

  content = replaceOnceRegex(
    content,
    /export function assinaturaEstaAtiva\(company: Record<string, unknown> \| null\) \{[\s\S]*?\n\}/,
    `export function assinaturaEstaAtiva(company: Record<string, unknown> | null) {
  return getCompanySubscriptionAccess(company as SubscriptionAccessInput | null).hasAccess
}`,
    "assinaturaEstaAtiva canônica",
  );

  if (!content.includes("export function companyPlanAllows(")) {
    content = replaceOnceText(
      content,
      `export function assinaturaEstaAtiva(company: Record<string, unknown> | null) {
  return getCompanySubscriptionAccess(company as SubscriptionAccessInput | null).hasAccess
}`,
      `export function assinaturaEstaAtiva(company: Record<string, unknown> | null) {
  return getCompanySubscriptionAccess(company as SubscriptionAccessInput | null).hasAccess
}

const COMPANY_PLAN_RANK: Record<PlanKey, number> = {
  essencial: 1,
  profissional: 2,
  premium: 3,
}

export function companyPlanAllows(
  company: Record<string, unknown> | null,
  requiredPlan: PlanKey,
) {
  if (!company) return false

  const current = normalizePlanKey(
    company.assinatura_plano || company.plano,
  )

  return COMPANY_PLAN_RANK[current] >= COMPANY_PLAN_RANK[requiredPlan]
}

const CLIENT_COMPANY_BLOCKED_KEYS = new Set([
  'assinatura_mp_payload',
  'raw_payload',
  'raw_payment',
  'raw_preference',
  'raw_subscription',
  'provider_metadata',
])

export function sanitizeCompanyForClient(
  company: Record<string, unknown> | null,
) {
  if (!company) return null

  return Object.fromEntries(
    Object.entries(company).filter(([key]) => {
      const normalized = key.toLowerCase()

      if (CLIENT_COMPANY_BLOCKED_KEYS.has(normalized)) return false
      if (normalized.includes('access_token')) return false
      if (normalized.includes('refresh_token')) return false
      if (normalized.includes('client_secret')) return false
      if (normalized.includes('secret')) return false
      if (normalized.includes('api_key')) return false
      if (normalized.includes('credential')) return false
      if (normalized.includes('encrypted')) return false
      if (normalized.includes('password')) return false
      if (normalized.endsWith('_token') || normalized.startsWith('token_')) return false

      return true
    }),
  )
}`,
      "company plan helper",
    );
  }

  content = replaceOnceRegex(
    content,
    /async function getAdminRole\([\s\S]*?\n\}\n\nexport async function getCompanyAccess/,
    `async function getPlatformOwnerRole(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  email?: string | null,
) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await supabaseAdmin
    .from('platform_admins')
    .select('role,is_active')
    .eq('is_active', true)
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return String(data?.role || '').toLowerCase() === 'owner'
    ? 'super_admin'
    : null
}

export async function getCompanyAccess`,
    "remove autoridade admin_users",
  );

  content = content.replace(
    "const adminRole = await getAdminRole(supabaseAdmin, email)",
    "const adminRole = await getPlatformOwnerRole(supabaseAdmin, email)",
  );
  // Remove fallback legado que transformava owner da plataforma em dono de um tenant fixo.
  content = content.replace(
    `  if (isAdminMaster) {
    const { data: adminCompany, error: adminCompanyError } =
      await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('slug', 'grafica-flash')
        .maybeSingle()

    if (adminCompanyError) throw adminCompanyError

    if (adminCompany?.id) {
      return {
        company: adminCompany,
        role: 'super_admin' as CurrentRole,
        ...permissionsByRole('dono', true),
      }
    }
  }

`,
    "",
  );

  if (content.includes(".from('admin_users')")) {
    throw new Error("company-access ainda referencia admin_users");
  }
  if (content.includes(".eq('slug', 'grafica-flash')")) {
    throw new Error("company-access ainda possui fallback de tenant para admin da plataforma");
  }
  return content;
});

patch("app/api/company/current/route.ts", (content) => {
  content = content.replace("  assinaturaEstaAtiva,\n", "");
  content = content.replace(
    "  getSupabaseAdmin,\n} from '@/lib/company-access'",
    "  getSupabaseAdmin,\n  sanitizeCompanyForClient,\n} from '@/lib/company-access'",
  );
  content = addImportAfter(
    content,
    "} from '@/lib/company-access'\n",
    "import { getCompanySubscriptionAccess } from '@/lib/subscription-access'",
    "company/current import subscription",
  );
  if (!content.includes("const subscriptionAccess = getCompanySubscriptionAccess")) {
    content = replaceOnceText(
      content,
      "    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)\n\n",
      "    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)\n    const subscriptionAccess = getCompanySubscriptionAccess(access.company)\n\n",
      "company/current access",
    );
  }
  content = content.replace(
    "      assinatura_ativa: assinaturaEstaAtiva(access.company),",
    "      assinatura_ativa: subscriptionAccess.hasAccess,\n      subscription_access: subscriptionAccess,",
  );
  content = content.replace(
    "      company: access.company,",
    "      company: sanitizeCompanyForClient(access.company),",
  );
  return content;
});

// 3) Catálogo de planos aplicado à navegação e rota
patch("lib/panel-modules.ts", (content) => {
  if (!content.startsWith("import { normalizePlanKey")) {
    content = `import { normalizePlanKey } from '@/lib/plans/plan-config'\n\n${content}`;
  }
  if (!content.includes("export function panelPlanAllows(")) {
    const marker = "\nexport { normalizeBusinessType as normalizePanelBusinessType }";
    const helper = `
const REQUIRED_PLAN_RANK: Record<Exclude<RequiredPlan, null>, number> = {
  basic: 1,
  intermediate: 2,
  premium: 3,
}

const ACTUAL_PLAN_RANK = {
  essencial: 1,
  profissional: 2,
  premium: 3,
} as const

export function panelPlanAllows(
  requiredPlan: RequiredPlan,
  actualPlan: unknown,
) {
  if (!requiredPlan) return true

  const normalized = normalizePlanKey(actualPlan)
  return ACTUAL_PLAN_RANK[normalized] >= REQUIRED_PLAN_RANK[requiredPlan]
}

export type PanelAccessPermissions = {
  can_finance?: boolean
  can_config?: boolean
  can_products?: boolean
  can_proposal?: boolean
  can_subscription?: boolean
  can_production?: boolean
}

export function panelPermissionAllows(
  moduleItem: Pick<PanelModule, 'id' | 'group'>,
  permissions?: PanelAccessPermissions | null,
) {
  if (!permissions) return true

  if (
    moduleItem.group === 'financeiro' ||
    moduleItem.id === 'pagamentos_marketplace'
  ) {
    return permissions.can_finance === true
  }

  if (
    ['clientes_crm', 'follow_up', 'propostas'].includes(moduleItem.id)
  ) {
    return permissions.can_proposal === true
  }

  if (moduleItem.id === 'produtos_servicos') {
    return permissions.can_products === true
  }

  if (moduleItem.id === 'configuracoes') {
    return permissions.can_config === true
  }

  if (moduleItem.id === 'assinatura') {
    return permissions.can_subscription !== false
  }

  if (moduleItem.id === 'producao') {
    return permissions.can_production === true
  }

  return true
}

export function findPanelModuleByPath(pathname: string) {
  const clean = String(pathname || '').split('?')[0]

  return panelModules
    .filter((moduleItem) => moduleItem.status === 'active')
    .map((moduleItem) => ({
      ...moduleItem,
      href: getSafeModuleHref(moduleItem),
    }))
    .filter(
      (moduleItem) =>
        clean === moduleItem.href ||
        clean.startsWith(\`\${moduleItem.href}/\`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0] || null
}
`;
    content = replaceOnceText(content, marker, `${helper}${marker}`, "panel plan helpers");
  }
  return content;
});

patch("components/painel/PanelSidebar.tsx", (content) => {
  content = content.replace(
    "import { getPanelModulesForBusinessType, panelGroupLabels, type PanelModuleGroup } from '@/lib/panel-modules'",
    "import { getPanelModulesForBusinessType, panelGroupLabels, panelPermissionAllows, panelPlanAllows, type PanelAccessPermissions, type PanelModuleGroup } from '@/lib/panel-modules'", 
  );
  content = content.replace(
    "export default function PanelSidebar({ company }: { company: PanelSidebarCompany }) {",
    "export default function PanelSidebar({ company, permissions }: { company: PanelSidebarCompany; permissions?: PanelAccessPermissions | null }) {",
  );
  content = content.replaceAll(
    "<SidebarGroups pathname={pathname} modules={modules} />",
    "<SidebarGroups pathname={pathname} modules={modules} plan={company.assinatura_plano || company.plano} permissions={permissions} />",
  );
  content = content.replace(
    "function SidebarGroups({ pathname, modules }: { pathname: string; modules: ReturnType<typeof getPanelModulesForBusinessType> }) {",
    "function SidebarGroups({ pathname, modules, plan, permissions }: { pathname: string; modules: ReturnType<typeof getPanelModulesForBusinessType>; plan?: string | null; permissions?: PanelAccessPermissions | null }) {",
  );
  content = content.replace(
    ".filter((module) => module.group === group && module.status === 'active')",
    ".filter((module) => module.group === group && module.status === 'active' && panelPlanAllows(module.requiredPlan, plan) && panelPermissionAllows(module, permissions))",
  );
  return content;
});


patch("components/painel/PanelPremiumShell.tsx", (content) => {
  content = addImportAfter(
    content,
    "import type { ReactNode } from 'react'\n",
    "import type { PanelAccessPermissions } from '@/lib/panel-modules'",
    "panel shell permissions type",
  );
  content = content.replace(
    `  pathname,
  children,
}: {
  company: PanelPremiumCompany
  pathname: string
  children: ReactNode
}) {`,
    `  pathname,
  permissions,
  children,
}: {
  company: PanelPremiumCompany
  pathname: string
  permissions?: PanelAccessPermissions | null
  children: ReactNode
}) {`,
  );
  content = content.replace(
    "<PanelSidebar company={company} />",
    "<PanelSidebar company={company} permissions={permissions} />",
  );
  return content;
});

patch("app/painel/layout.tsx", (content) => {
  content = addImportAfter(
    content,
    "import { getCompanyPublicHost } from '@/lib/company-url'\n",
    "import { findPanelModuleByPath, panelPermissionAllows, panelPlanAllows, type PanelAccessPermissions, type RequiredPlan } from '@/lib/panel-modules'",
    "layout plan import",
  );
  content = content.replace(
    `  permissions?: {
    can_subscription?: boolean
  }`,
    `  permissions?: PanelAccessPermissions`,
  );

  if (!content.includes("function PainelPlanoBloqueado(")) {
    const marker = "\nexport default function PainelLayout";
    const block = `
function PainelPlanoBloqueado({
  moduleLabel,
  requiredPlan,
}: {
  moduleLabel: string
  requiredPlan: RequiredPlan
}) {
  const plano =
    requiredPlan === 'premium'
      ? 'Premium'
      : requiredPlan === 'intermediate'
        ? 'Profissional'
        : 'Essencial'

  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#f8fbff] px-4 py-10 text-[#071b3a]">
      <section className="w-full max-w-2xl rounded-[2rem] border border-blue-100 bg-white p-7 text-center shadow-xl shadow-blue-950/8 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1359a5]">
          Recurso do plano {plano}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">
          {moduleLabel} não faz parte do seu plano atual.
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-bold leading-7 text-slate-500">
          Seus dados permanecem preservados. Para usar este recurso, faça o upgrade da assinatura.
        </p>
        <Link
          href="/painel/assinatura"
          className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
        >
          Ver planos e fazer upgrade
        </Link>
      </section>
    </main>
  )
}
`;
    content = replaceOnceText(content, marker, `${block}${marker}`, "layout plano bloqueado");
  }

  if (!content.includes("function PainelPermissaoBloqueada(")) {
    const marker = "\nexport default function PainelLayout";
    const block = `
function PainelPermissaoBloqueada({ moduleLabel }: { moduleLabel: string }) {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#f8fbff] px-4 py-10 text-[#071b3a]">
      <section className="w-full max-w-2xl rounded-[2rem] border border-blue-100 bg-white p-7 text-center shadow-xl shadow-blue-950/8 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1359a5]">
          Permissão necessária
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">
          Seu perfil não pode acessar {moduleLabel}.
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-bold leading-7 text-slate-500">
          Peça ao dono ou gerente da empresa para revisar seu cargo e permissões.
        </p>
        <Link
          href="/painel/inicio"
          className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
        >
          Voltar à visão geral
        </Link>
      </section>
    </main>
  )
}
`;
    content = replaceOnceText(content, marker, `${block}${marker}`, "layout permissao bloqueada");
  }

  if (!content.includes("const currentModule = findPanelModuleByPath(pathname)")) {
    const old = `  if (payload.assinatura_ativa !== true && pathname !== '/painel/assinatura') {
    return <PainelBloqueado payload={payload} />
  }

  return (
`;
    const neu = `  if (payload.assinatura_ativa !== true && pathname !== '/painel/assinatura') {
    return <PainelBloqueado payload={payload} />
  }

  const currentModule = findPanelModuleByPath(pathname)
  const currentPlan =
    payload.company.assinatura_plano || payload.company.plano

  if (
    currentModule &&
    !panelPlanAllows(currentModule.requiredPlan, currentPlan) &&
    pathname !== '/painel/assinatura'
  ) {
    return (
      <PainelPlanoBloqueado
        moduleLabel={currentModule.label}
        requiredPlan={currentModule.requiredPlan}
      />
    )
  }

  if (
    currentModule &&
    !panelPermissionAllows(currentModule, payload.permissions) &&
    pathname !== '/painel/assinatura'
  ) {
    return <PainelPermissaoBloqueada moduleLabel={currentModule.label} />
  }

  return (
`;
    content = replaceOnceText(content, old, neu, "layout plan gate");
  }
  return content;
});

// 4) Catálogo canônico da Academia compartilhado entre cliente e servidor
patch("components/parceiros/PartnerCoursesTab.tsx", (content) => {
  if (content.includes("@/lib/affiliates/academy-catalog")) return content;

  const typeStart = content.indexOf("type Lesson = {");
  const storageStart = content.indexOf('const STORAGE_KEY = "orcaly-partner-academy-v2";');
  const courseStart = content.indexOf("const courses: Course[] = [");
  const functionStart = content.indexOf("\n\nfunction allLessonIds(course: Course)");

  if ([typeStart, storageStart, courseStart, functionStart].some((value) => value < 0)) {
    throw new Error("Não foi possível localizar blocos da Academia para extração");
  }

  const typesBlock = content.slice(typeStart, storageStart);
  const courseBlock = content.slice(courseStart, functionStart);
  const shared = `${typesBlock
    .replace("type Lesson = {", "export type Lesson = {")
    .replace("type Course = {", "export type Course = {")}
${courseBlock.replace("const courses: Course[] =", "export const courses: Course[] =")}

export function getCourseById(courseId: string) {
  return courses.find((course) => course.id === courseId) || null;
}

export function getCourseLessonIds(courseId: string) {
  return getCourseById(courseId)?.lessons.map((lesson) => lesson.id) || [];
}

export function isValidCourseLesson(courseId: string, lessonId: string) {
  return getCourseLessonIds(courseId).includes(lessonId);
}
`;
  createOrReplace("lib/affiliates/academy-catalog.ts", shared);

  content = content.slice(0, typeStart) + content.slice(storageStart, courseStart) + content.slice(functionStart);
  content = addImportAfter(
    content,
    'import { supabase } from "@/lib/supabase";\n',
    'import { courses, type Course } from "@/lib/affiliates/academy-catalog";',
    "academy shared import",
  );

  const oldRemote = `          const remoteIds = (payload.courseProgress || [])
            .map((row) => String(row.lesson_id || ""))
            .filter(Boolean);

          if (remoteIds.length) {
            setCompletedLessons((current) => {
              return new Set([...current, ...remoteIds]);
            });
          }`;
  const newRemote = `          const remoteIds = (payload.courseProgress || [])
            .map((row) => String(row.lesson_id || ""))
            .filter(Boolean);

          // Autenticado: o servidor é a fonte de verdade.
          setCompletedLessons(new Set(remoteIds));`;
  content = replaceOnceText(content, oldRemote, newRemote, "academy remote source of truth");

  return content;
});

// 5) Central de Parceiros: validações server-side e XP idempotente
patch("lib/affiliates/workspace.ts", (content) => {
  content = addImportAfter(
    content,
    "} from \"@/lib/affiliates/server\";\n",
    'import { getCourseLessonIds, isValidCourseLesson } from "@/lib/affiliates/academy-catalog";',
    "workspace academy import",
  );
  content = addImportAfter(
    content,
    'import { getCourseLessonIds, isValidCourseLesson } from "@/lib/affiliates/academy-catalog";\n',
    'import { partnerTrainerScenarios } from "@/components/parceiros/partner-growth-content";',
    "workspace trainer import",
  );

  // Valida progresso histórico também.
  if (!content.includes("const validProgress = progress.filter")) {
    content = replaceOnceText(
      content,
      `function certificationEligibility(
  exam: CertificationExam,
  progress: Array<{ course_id?: string | null; lesson_id?: string | null }>,
) {
  if (exam.prerequisite.type === "lessons") {
    return progress.length >= exam.prerequisite.minimum;
  }

  const allowed = new Set(exam.prerequisite.courseIds || []);
  const completed = progress.filter((row) =>
    allowed.has(String(row.course_id || "")),
  ).length;
`,
      `function certificationEligibility(
  exam: CertificationExam,
  progress: Array<{ course_id?: string | null; lesson_id?: string | null }>,
) {
  const validProgress = progress.filter((row) =>
    isValidCourseLesson(
      String(row.course_id || ""),
      String(row.lesson_id || ""),
    ),
  );

  if (exam.prerequisite.type === "lessons") {
    return validProgress.length >= exam.prerequisite.minimum;
  }

  const allowed = new Set(exam.prerequisite.courseIds || []);
  const completed = validProgress.filter((row) =>
    allowed.has(String(row.course_id || "")),
  ).length;
`,
      "canonical certification progress",
    );
  }

  if (!content.includes("sourceKey?: string;")) {
    content = replaceOnceText(
      content,
      `  options: {
    leadId?: string | null;
    metadata?: JsonRecord;
    xp?: number;
  } = {},
) {`,
      `  options: {
    leadId?: string | null;
    metadata?: JsonRecord;
    xp?: number;
    sourceKey?: string;
  } = {},
) {`,
      "insertEvent sourceKey option",
    );
  }

  if (!content.includes('metadata: eventMetadata')) {
    content = replaceOnceText(
      content,
      `  const { error } = await admin.from("affiliate_activity_events").insert({
    affiliate_id: affiliateId,
    lead_id: options.leadId || null,
    kind,
    xp,
    metadata: options.metadata || {},
  });

  if (error) throw error;`,
      `  const eventMetadata = {
    ...(options.metadata || {}),
    ...(options.sourceKey ? { source_key: options.sourceKey } : {}),
  };

  if (options.sourceKey) {
    const { data: existing, error: lookupError } = await admin
      .from("affiliate_activity_events")
      .select("id")
      .eq("affiliate_id", affiliateId)
      .eq("metadata->>source_key", options.sourceKey)
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing?.id) return;
  }

  const { error } = await admin.from("affiliate_activity_events").insert({
    affiliate_id: affiliateId,
    lead_id: options.leadId || null,
    kind,
    xp,
    metadata: eventMetadata,
  });

  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (options.sourceKey && (message.includes("duplicate") || message.includes("unique"))) {
      return;
    }
    throw error;
  }`,
      "insertEvent idempotency",
    );
  }

  // Mascara nomes nos rankings.
  if (!content.includes("function leaderboardName(")) {
    const marker = "\nasync function buildLeaderboards(admin: AdminClient)";
    const helper = `
function leaderboardName(value: unknown) {
  const parts = cleanText(value, 120).split(/\\s+/).filter(Boolean);
  if (!parts.length) return "Parceiro";
  if (parts.length === 1) return parts[0];
  return \`\${parts[0]} \${parts[1][0] || ""}***\`.trim();
}
`;
    content = replaceOnceText(content, marker, `${helper}${marker}`, "leaderboard mask helper");
    content = content.replace(
      'String(row.name || "Parceiro"),',
      'leaderboardName(row.name),',
    );
  }

  // Lead criado: XP uma vez.
  content = content.replace(
    `    await insertEvent(admin, affiliateId, "manual", {
      leadId: String(data.id),
      metadata: { event: "lead_created" },
      xp: 5,
    });`,
    `    await insertEvent(admin, affiliateId, "manual", {
      leadId: String(data.id),
      metadata: { event: "lead_created" },
      xp: 5,
      sourceKey: \`lead:\${data.id}:created\`,
    });`,
  );

  // Milestone do lead: XP uma vez por status.
  content = content.replace(
    `        await insertEvent(admin, affiliateId, kind, {
          leadId,
          metadata: {
            from: current.status,
            to: status,
          },
        });`,
    `        await insertEvent(admin, affiliateId, kind, {
          leadId,
          metadata: {
            from: current.status,
            to: status,
          },
          sourceKey: \`lead:\${leadId}:status:\${kind}\`,
        });`,
  );

  // Tarefa: XP uma vez por tarefa.
  content = content.replace(
    `      await insertEvent(admin, affiliateId, "task", {
        leadId: data.lead_id ? String(data.lead_id) : null,
        metadata: { taskId },
      });`,
    `      await insertEvent(admin, affiliateId, "task", {
        leadId: data.lead_id ? String(data.lead_id) : null,
        metadata: { taskId },
        sourceKey: \`task:\${taskId}:completed\`,
      });`,
  );

  // Atividades manuais contam para métricas, mas não dão XP.
  content = content.replace(
    `        metadata: {
          note: optionalText(body.note, 500),
          source: "manual",
        },
      },`,
    `        metadata: {
          note: optionalText(body.note, 500),
          source: "manual",
        },
        xp: 0,
      },`,
  );

  // Complete lesson: valida catálogo.
  if (!content.includes('if (!isValidCourseLesson(courseId, lessonId))')) {
    content = replaceOnceText(
      content,
      `    if (!courseId || !lessonId) {
      throw new AffiliateError("Aula inválida.");
    }
`,
      `    if (!courseId || !lessonId || !isValidCourseLesson(courseId, lessonId)) {
      throw new AffiliateError("Aula inválida.");
    }
`,
      "complete lesson validation",
    );
  }
  content = content.replace(
    `      await insertEvent(admin, affiliateId, "lesson", {
        metadata: { courseId, lessonId },
      });`,
    `      await insertEvent(admin, affiliateId, "lesson", {
        metadata: { courseId, lessonId },
        sourceKey: \`lesson:\${courseId}:\${lessonId}\`,
      });`,
  );

  // Uncomplete lesson também só para aula conhecida.
  if (!content.includes('if (!isValidCourseLesson(courseId, lessonId)) {\n      throw new AffiliateError("Aula inválida.");\n    }\n\n    const { error } = await admin\n      .from("affiliate_course_progress")\n      .delete()')) {
    content = replaceOnceText(
      content,
      `    const courseId = cleanText(body.courseId, 80);
    const lessonId = cleanText(body.lessonId, 120);

    const { error } = await admin
      .from("affiliate_course_progress")
      .delete()`,
      `    const courseId = cleanText(body.courseId, 80);
    const lessonId = cleanText(body.lessonId, 120);

    if (!isValidCourseLesson(courseId, lessonId)) {
      throw new AffiliateError("Aula inválida.");
    }

    const { error } = await admin
      .from("affiliate_course_progress")
      .delete()`,
      "uncomplete lesson validation",
    );
  }

  // Whole course: servidor deriva IDs.
  content = replaceOnceRegex(
    content,
    /  if \(action === "set_course_lessons"\) \{\n    const courseId = cleanText\(body\.courseId, 80\);\n    const lessonIds = Array\.isArray\(body\.lessonIds\)[\s\S]*?    const complete = body\.complete === true;/,
    `  if (action === "set_course_lessons") {
    const courseId = cleanText(body.courseId, 80);
    const lessonIds = getCourseLessonIds(courseId);
    const complete = body.complete === true;`,
    "set_course_lessons canonical IDs",
  );
  // sourceKey no loop de whole course.
  content = content.replace(
    `        await insertEvent(admin, affiliateId, "lesson", {
          metadata: { courseId, lessonId },
        });`,
    `        await insertEvent(admin, affiliateId, "lesson", {
          metadata: { courseId, lessonId },
          sourceKey: \`lesson:\${courseId}:\${lessonId}\`,
        });`,
  );

  // Treinamento: cliente envia só cenário + escolha; servidor calcula tudo.
  content = replaceOnceRegex(
    content,
    /  if \(action === "save_training"\) \{[\s\S]*?    return \{ message: "Treinamento registrado\.", training: data \};\n  \}/,
    `  if (action === "save_training") {
    const scenarioId = cleanText(body.scenarioId, 100);
    const choiceIndex = cleanInteger(body.choiceIndex, -1, -1, 100);
    const scenario = partnerTrainerScenarios.find(
      (item) => item.id === scenarioId,
    );
    const option = scenario?.options[choiceIndex];

    if (!scenario || !option) {
      throw new AffiliateError("Treinamento inválido.");
    }

    const mode =
      scenario.category === "Demonstração"
        ? "demo"
        : scenario.category === "Objeções"
          ? "objection"
          : "sales";
    const totalScore = cleanNumber(option.score, 0, 0, 100);

    const { data, error } = await admin
      .from("affiliate_training_sessions")
      .insert({
        affiliate_id: affiliateId,
        mode,
        scenario_id: scenario.id,
        answer: option.text,
        total_score: totalScore,
        score_json: option.dimensions,
        feedback: option.feedback,
      })
      .select("*")
      .single();

    if (error) throw error;

    const utcDay = new Date().toISOString().slice(0, 10);
    await insertEvent(admin, affiliateId, "practice", {
      metadata: {
        mode,
        scenarioId: scenario.id,
        totalScore,
      },
      sourceKey: \`practice:\${scenario.id}:\${utcDay}\`,
    });

    return { message: "Treinamento registrado.", training: data };
  }`,
    "server-authoritative training",
  );

  // Certificação: só aprovado dá XP, uma vez.
  content = content.replace(
    `    await insertEvent(admin, affiliateId, "quiz", {
      metadata: { examId, score, passed },
      xp: passed ? 80 : 20,
    });

    if (passed) {`,
    `    if (passed) {
      await insertEvent(admin, affiliateId, "quiz", {
        metadata: { examId, score, passed },
        xp: 80,
        sourceKey: \`certification:\${examId}:passed\`,
      });
`,
  );

  return content;
});

patch("components/parceiros/PartnerGrowthHub.tsx", (content) => {
  content = content.replace(
    `                            dueAt:
                              lead.next_follow_up_at ||
                              new Date(
                                currentTimestamp + 24 * 60 * 60 * 1000,
                              ).toISOString(),`,
    `                            dueAt:
                              lead.next_follow_up_at ||
                              new Date(
                                Date.now() + 24 * 60 * 60 * 1000,
                              ).toISOString(),`,
  );

  content = content.replace(
    `                      void postAction("save_training", {
                        mode:
                          activeTrainer.category === "Demonstração"
                            ? "demo"
                            : activeTrainer.category === "Objeções"
                              ? "objection"
                              : "sales",
                        scenarioId: activeTrainer.id,
                        answer:
                          activeTrainer.options[trainerChoice].text,
                        totalScore:
                          activeTrainer.options[trainerChoice].score,
                        scoreJson:
                          activeTrainer.options[trainerChoice].dimensions,
                        feedback:
                          activeTrainer.options[trainerChoice].feedback,
                      })`,
    `                      void postAction("save_training", {
                        scenarioId: activeTrainer.id,
                        choiceIndex: trainerChoice,
                      })`,
  );
  return content;
});

// 6) Parceiros: CPF/CNPJ real + limites HTTP
patch("lib/affiliates/server.ts", (content) => {
  content = addImportAfter(
    content,
    'import type { NextRequest } from "next/server";\n',
    'import { documentDigits, isValidCpfCnpj } from "@/lib/br-document";',
    "affiliate document import",
  );
  content = replaceOnceRegex(
    content,
    /function validateDocument\(value: unknown\) \{[\s\S]*?\n\}/,
    `function validateDocument(value: unknown) {
  const clean = documentDigits(value);

  if (!isValidCpfCnpj(clean)) {
    throw new AffiliateError("Informe um CPF ou CNPJ válido.");
  }

  return clean;
}`,
    "affiliate document checksum",
  );

  content = content.replace(
    `  return normalized === "premium" ? "premium" : "profissional";`,
    `  if (normalized === "premium") return "premium";
  return "basico";`,
  );

  content = content.replace(
    `export async function requestAffiliatePayout(request: NextRequest) {
  const { admin, profile, user } = await requireAffiliate(request);
  const { data, error } = await admin.rpc(`,
    `export async function requestAffiliatePayout(request: NextRequest) {
  const { admin, profile, user } = await requireAffiliate(request);
  const settings = await programSettings(admin);

  if (!Boolean(settings.payouts_enabled)) {
    throw new AffiliateError("Pagamentos de parceiros estão temporariamente indisponíveis.", 503);
  }

  const { data, error } = await admin.rpc(`,
  );

  content = content.replace(
    `import {
  AsaasProvider,
  type PixKeyType,
} from "@/lib/payments/providers/asaas";`,
    `import {
  AsaasApiError,
  AsaasProvider,
  type PixKeyType,
} from "@/lib/payments/providers/asaas";`,
  );

  content = content.replace(
    `    const { error } = await admin
      .from("affiliate_payouts")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        admin_note: text(input.note).slice(0, 500) || null,
      })
      .eq("id", payoutId)
      .eq("status", "requested");
    if (error) throw error;`,
    `    const { data: approvedPayout, error } = await admin
      .from("affiliate_payouts")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        admin_note: text(input.note).slice(0, 500) || null,
      })
      .eq("id", payoutId)
      .eq("status", "requested")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!approvedPayout?.id) {
      throw new AffiliateError("Pagamento não está mais aguardando aprovação.", 409);
    }`,
  );

  if (!content.includes("Pagamento já está sendo processado ou não foi aprovado.")) {
    content = replaceOnceText(
      content,
      `    const account = await getPayoutAccount(admin, payout.affiliate_id);
    if (!account?.is_verified) {
      throw new AffiliateError("A conta Pix ainda não foi verificada.", 409);
    }

    await admin
      .from("affiliate_payouts")
      .update({
        status: "processing",
        provider: "asaas",
        processing_at: new Date().toISOString(),
      })
      .eq("id", payout.id);`,
      `    const account = await getPayoutAccount(admin, payout.affiliate_id);
    if (!account?.is_verified) {
      throw new AffiliateError("A conta Pix ainda não foi verificada.", 409);
    }

    if (String(payout.status) !== "approved") {
      throw new AffiliateError(
        "O pagamento precisa ser aprovado antes do envio.",
        409,
      );
    }

    const { data: claimedPayout, error: claimError } = await admin
      .from("affiliate_payouts")
      .update({
        status: "processing",
        provider: "asaas",
        processing_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq("id", payout.id)
      .eq("status", "approved")
      .select("id")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimedPayout?.id) {
      throw new AffiliateError(
        "Pagamento já está sendo processado ou não foi aprovado.",
        409,
      );
    }`,
      "affiliate payout atomic claim",
    );

    content = content.replace(
      `.eq("id", payoutId)
      .in("status", ["requested", "approved"])
      .maybeSingle();`,
      `.eq("id", payoutId)
      .eq("status", "approved")
      .maybeSingle();`,
    );

    content = replaceOnceText(
      content,
      `    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Falha na transferência Pix.";
      await admin.rpc("fail_affiliate_payout_admin", {
        p_payout_id: payout.id,
        p_reason: reason,
      });
      throw new AffiliateError(reason, 502);
    }`,
      `    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Falha na transferência Pix.";

      if (error instanceof AsaasApiError && error.status >= 400 && error.status < 500) {
        await admin.rpc("fail_affiliate_payout_admin", {
          p_payout_id: payout.id,
          p_reason: reason,
        });
      } else {
        await admin
          .from("affiliate_payouts")
          .update({
            status: "processing",
            failure_reason: (
              "Resultado incerto no provedor. Não reenviar automaticamente: " + reason
            ).slice(0, 500),
          })
          .eq("id", payout.id)
          .eq("status", "processing");
      }

      throw new AffiliateError(
        error instanceof AsaasApiError && error.status >= 400 && error.status < 500
          ? reason
          : "O envio ficou em estado de confirmação. Não reenvie; aguarde a conciliação do provedor.",
        502,
      );
    }`,
      "affiliate payout uncertain provider result",
    );

    content = replaceOnceText(
      content,
      `  const { data: payout, error } = await admin
    .from("affiliate_payouts")
    .select("*")
    .eq("provider", "asaas")
    .eq("provider_transfer_id", transferId)
    .maybeSingle();

  if (error) throw error;
  if (!payout?.id) return false;`,
      `  let { data: payout, error } = await admin
    .from("affiliate_payouts")
    .select("*")
    .eq("provider", "asaas")
    .eq("provider_transfer_id", transferId)
    .maybeSingle();

  if (error) throw error;

  const externalReference = text(transfer.externalReference);
  if (!payout?.id && externalReference) {
    const fallback = await admin
      .from("affiliate_payouts")
      .select("*")
      .eq("provider", "asaas")
      .eq("external_reference", externalReference)
      .eq("status", "processing")
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    payout = fallback.data;

    if (payout?.id && !payout.provider_transfer_id) {
      await admin
        .from("affiliate_payouts")
        .update({ provider_transfer_id: transferId })
        .eq("id", payout.id)
        .eq("status", "processing");
    }
  }

  if (!payout?.id) return false;`,
      "affiliate payout webhook fallback external reference",
    );
  }
  return content;
});

patch("app/api/parceiros/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { NextRequest, NextResponse } from "next/server";\n',
    'import { enforceRateLimit } from "@/lib/security/rate-limit";',
    "partner portal rate import",
  );
  content = addImportAfter(
    content,
    'import { enforceRateLimit } from "@/lib/security/rate-limit";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "partner portal body import",
  );

  if (!content.includes('scope: "affiliate-portal-read"')) {
    content = content.replace(
      `export async function GET(request: NextRequest) {
  try {`,
      `export async function GET(request: NextRequest) {
  try {
    const blocked = await enforceRateLimit(request, {
      scope: "affiliate-portal-read",
      limit: 120,
      windowSeconds: 60,
    });
    if (blocked) return blocked;`,
    );
  }

  if (!content.includes('scope: "affiliate-portal-write"')) {
    content = content.replace(
      `export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;`,
      `export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceRateLimit(request, {
      scope: "affiliate-portal-write",
      limit: 20,
      windowSeconds: 60,
    });
    if (blocked) return blocked;

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      16 * 1024,
    );`,
    );
  }

  content = content.replaceAll(
    `  } catch (error) {
    return NextResponse.json(`,
    `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    return NextResponse.json(`,
  );

  return content;
});

patch("app/api/parceiros/workspace/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { NextRequest, NextResponse } from "next/server";\n',
    'import { enforceRateLimit } from "@/lib/security/rate-limit";',
    "workspace rate import",
  );
  content = addImportAfter(
    content,
    'import { enforceRateLimit } from "@/lib/security/rate-limit";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "workspace body import",
  );

  if (!content.includes('scope: "affiliate-workspace-read"')) {
    content = content.replace(
      `export async function GET(request: NextRequest) {
  try {`,
      `export async function GET(request: NextRequest) {
  try {
    const blocked = await enforceRateLimit(request, {
      scope: "affiliate-workspace-read",
      limit: 120,
      windowSeconds: 60,
    });
    if (blocked) return blocked;`,
    );
  }
  if (!content.includes('scope: "affiliate-workspace-write"')) {
    content = content.replace(
      `export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;`,
      `export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceRateLimit(request, {
      scope: "affiliate-workspace-write",
      limit: 60,
      windowSeconds: 60,
    });
    if (blocked) return blocked;

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      32 * 1024,
    );`,
    );
  }
  // Aplica resposta 413/400 de body nos dois catches sem reescrever mensagens.
  content = content.replaceAll(
    `  } catch (error) {
    return NextResponse.json(`,
    `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    return NextResponse.json(`,
  );
  return content;
});

patch("app/api/parceiros/register/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { NextRequest, NextResponse } from "next/server";\n',
    'import { enforceRateLimit } from "@/lib/security/rate-limit";',
    "partner register rate import",
  );
  content = addImportAfter(
    content,
    'import { enforceRateLimit } from "@/lib/security/rate-limit";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "partner register body import",
  );
  content = content.replace(
    `export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));`,
    `export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceRateLimit(request, {
      scope: "affiliate-register",
      limit: 5,
      windowSeconds: 3600,
    });
    if (blocked) return blocked;

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      16 * 1024,
    );`,
  );
  content = content.replace(
    `  } catch (error) {
    return NextResponse.json(`,
    `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    return NextResponse.json(`,
  );
  return content;
});

patch("app/api/parceiros/track/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { NextRequest, NextResponse } from "next/server";\n',
    'import { enforceRateLimit } from "@/lib/security/rate-limit";',
    "partner track rate import",
  );
  content = addImportAfter(
    content,
    'import { enforceRateLimit } from "@/lib/security/rate-limit";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "partner track body import",
  );
  content = content.replace(
    `export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));`,
    `export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceRateLimit(request, {
      scope: "affiliate-track",
      limit: 120,
      windowSeconds: 60,
    });
    if (blocked) return blocked;

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      8 * 1024,
    );`,
  );
  content = content.replace(
    `  } catch {
    return NextResponse.json({ tracked: false });
  }`,
    `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ tracked: false });
  }`,
  );
  return content;
});

// 7) Signup público: byte limit, rate limit, origem, dados explícitos e CPF/CNPJ real
patch("app/api/checkout/lead/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { createClient } from "@supabase/supabase-js";\n',
    'import { requireSameOrigin } from "@/lib/orcaly-security";',
    "signup origin import",
  );
  content = addImportAfter(
    content,
    'import { requireSameOrigin } from "@/lib/orcaly-security";\n',
    'import { enforceRateLimit } from "@/lib/security/rate-limit";',
    "signup rate import",
  );
  content = addImportAfter(
    content,
    'import { enforceRateLimit } from "@/lib/security/rate-limit";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "signup body import",
  );
  content = addImportAfter(
    content,
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";\n',
    'import { documentDigits, isValidCpfCnpj } from "@/lib/br-document";',
    "signup doc import",
  );
  content = addImportAfter(
    content,
    'import { documentDigits, isValidCpfCnpj } from "@/lib/br-document";\n',
    'import { normalizePlanKey } from "@/lib/plans/plan-config";',
    "signup plan import",
  );

  content = content.replace(
    `function documentoLimpo(valor: unknown) {
  return String(valor || "").replace(/\\D/g, "");
}

`,
    "",
  );

  content = content.replace(
    `export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {`,
    `export async function POST(request: NextRequest) {
  try {
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    const blocked = await enforceRateLimit(request, {
      scope: "signup-lead",
      limit: 8,
      windowSeconds: 3600,
    });
    if (blocked) return blocked;

    if (!supabaseUrl || !serviceRoleKey) {`,
  );
  content = content.replace(
    `    const body = await request.json();`,
    `    const body = await readJsonBody<Record<string, unknown>>(
      request,
      32 * 1024,
    );`,
  );
  content = content.replace("const cpf_cnpj = documentoLimpo(", "const cpf_cnpj = documentDigits(");
  content = content.replace(
    `    const plano = String(body.plano || "profissional").trim().toLowerCase();`,
    `    const plano = normalizePlanKey(body.plano || "profissional");`,
  );
  content = content.replace(
    `    if (![11, 14].includes(cpf_cnpj.length)) {
      return erro("Informe um CPF ou CNPJ válido.");
    }`,
    `    if (!isValidCpfCnpj(cpf_cnpj)) {
      return erro("Informe um CPF ou CNPJ válido.");
    }`,
  );

  // Não persiste propriedades arbitrárias enviadas pelo navegador.
  content = content.replace(
    `    const rawData = {
      ...body,
      cpf_cnpj,`,
    `    const rawData = {
      nome_responsavel,
      email,
      whatsapp,
      empresa_nome,
      cidade,
      estado,
      plano,
      cpf_cnpj,`,
  );

  content = content.replace(
    `  } catch (error) {
    return erro(`,
    `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    return erro(`,
  );
  return content;
});

// Finalização da conta exige o mesmo token HMAC do checkout e limita tentativas.
patch("app/api/leads/complete-account/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { createClient } from "@supabase/supabase-js";\n',
    'import { requireSameOrigin } from "@/lib/orcaly-security";',
    "complete account origin import",
  );
  content = addImportAfter(
    content,
    'import { requireSameOrigin } from "@/lib/orcaly-security";\n',
    'import { enforceRateLimit } from "@/lib/security/rate-limit";',
    "complete account rate import",
  );
  content = addImportAfter(
    content,
    'import { enforceRateLimit } from "@/lib/security/rate-limit";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "complete account body import",
  );
  content = addImportAfter(
    content,
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";\n',
    'import { verifySignupCheckoutToken } from "@/lib/signup-checkout";',
    "complete account token import",
  );

  if (!content.includes("let createdAuthUserId: string | null = null;")) {
    content = content.replace(
      `export async function POST(request: NextRequest) {
  try {`,
      `export async function POST(request: NextRequest) {
  let createdAuthUserId: string | null = null;
  let createdCompanyId: string | null = null;

  try {
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    const blocked = await enforceRateLimit(request, {
      scope: "complete-signup-account",
      limit: 8,
      windowSeconds: 3600,
    });
    if (blocked) return blocked;`,
    );
  }

  content = content.replace(
    `    const body = await request.json();

    const leadId = String(body.lead_id || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirm_password || "");`,
    `    const body = await readJsonBody<Record<string, unknown>>(
      request,
      16 * 1024,
    );

    const leadId = String(body.lead_id || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirm_password || "");
    const expires = Number(body.expires || 0);
    const checkoutToken = String(body.token || "").trim();`,
  );

  if (!content.includes('if (!verifySignupCheckoutToken(leadId, expires, checkoutToken))')) {
    content = replaceOnceText(
      content,
      `    if (!leadId) return erro("Cadastro ausente.");
    if (password.length < 8) {
      return erro("A senha precisa ter pelo menos 8 caracteres.");
    }
    if (password !== confirmPassword) {`,
      `    if (!leadId) return erro("Cadastro ausente.");
    if (!verifySignupCheckoutToken(leadId, expires, checkoutToken)) {
      return erro("Este link de criação de conta é inválido ou expirou.", 401);
    }
    if (password.length < 8) {
      return erro("A senha precisa ter pelo menos 8 caracteres.");
    }
    if (!/[A-Za-z]/.test(password) || !/\\d/.test(password)) {
      return erro("Use pelo menos uma letra e um número na senha.");
    }
    if (password !== confirmPassword) {`,
      "complete account token validation",
    );
  }

  content = content.replace(
    `    const userId = authData.user.id;

    let slug =`,
    `    const userId = authData.user.id;
    createdAuthUserId = userId;

    let slug =`,
  );

  content = content.replace(
    `    const company = await insertCompany(companyPayload);

    try {`,
    `    const company = await insertCompany(companyPayload);
    createdCompanyId = String(company.id);

    try {`,
  );

  content = content.replace(
    `  } catch (error) {
    return NextResponse.json(`,
    `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    let authCleanupAllowed = true;

    if (createdCompanyId) {
      try {
        const cleanupCompany = await supabaseAdmin
          .from("companies")
          .delete()
          .eq("id", createdCompanyId)
          .eq("owner_id", createdAuthUserId);

        if (cleanupCompany.error) {
          authCleanupAllowed = false;
          console.error(
            "orcaly_signup_orphan_company_cleanup_error",
            cleanupCompany.error.message,
          );
        }
      } catch (cleanupError) {
        authCleanupAllowed = false;
        console.error(
          "orcaly_signup_orphan_company_cleanup_error",
          cleanupError instanceof Error ? cleanupError.message : cleanupError,
        );
      }
    }

    if (createdAuthUserId && authCleanupAllowed) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      } catch (cleanupError) {
        console.error(
          "orcaly_signup_orphan_user_cleanup_error",
          cleanupError instanceof Error ? cleanupError.message : cleanupError,
        );
      }
    }

    return NextResponse.json(`,
  );

  return content;
});

patch("components/checkout/SignupCheckout.tsx", (content) => {
  content = content.replace(
    `        body: JSON.stringify({
          lead_id: leadId,
          password,
          confirm_password: confirmPassword,
        }),`,
    `        body: JSON.stringify({
          lead_id: leadId,
          expires,
          token,
          password,
          confirm_password: confirmPassword,
        }),`,
  );
  return content;
});

// Endpoints de pagamento do cadastro também usam limite real de bytes e rate limit.
for (const signupPaymentRoute of [
  {
    file: "app/api/checkout/signup/pix/route.ts",
    scope: "signup-pix",
    maxBytes: 12 * 1024,
  },
  {
    file: "app/api/checkout/signup/card/route.ts",
    scope: "signup-card",
    maxBytes: 16 * 1024,
  },
]) {
  patch(signupPaymentRoute.file, (content) => {
    content = addImportAfter(
      content,
      'import { NextRequest, NextResponse } from "next/server";\n',
      'import { requireSameOrigin } from "@/lib/orcaly-security";',
      `${signupPaymentRoute.file} origin`,
    );
    content = addImportAfter(
      content,
      'import { requireSameOrigin } from "@/lib/orcaly-security";\n',
      'import { enforceRateLimit } from "@/lib/security/rate-limit";',
      `${signupPaymentRoute.file} rate`,
    );
    content = addImportAfter(
      content,
      'import { enforceRateLimit } from "@/lib/security/rate-limit";\n',
      'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
      `${signupPaymentRoute.file} body`,
    );

    if (!content.includes(`scope: "${signupPaymentRoute.scope}"`)) {
      content = content.replace(
        `export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));`,
        `export async function POST(request: NextRequest) {
  try {
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    const blocked = await enforceRateLimit(request, {
      scope: "${signupPaymentRoute.scope}",
      limit: 20,
      windowSeconds: 600,
    });
    if (blocked) return blocked;

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      ${signupPaymentRoute.maxBytes},
    );`,
      );
    }

    if (!content.includes("const bodyError = requestBodyErrorResponse(error);")) {
      content = content.replace(
        `  } catch (error) {
    return NextResponse.json(`,
        `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    return NextResponse.json(`,
      );
    }

    return content;
  });
}

// GETs assinados do checkout também protegem consultas ao provedor.
for (const signupReadRoute of [
  {
    file: "app/api/checkout/signup/route.ts",
    scope: "signup-checkout-read",
    limit: 60,
  },
  {
    file: "app/api/checkout/signup/status/route.ts",
    scope: "signup-checkout-status",
    limit: 180,
  },
]) {
  patch(signupReadRoute.file, (content) => {
    content = addImportAfter(
      content,
      'import { NextRequest, NextResponse } from "next/server";\n',
      'import { enforceRateLimit } from "@/lib/security/rate-limit";',
      `${signupReadRoute.file} rate import`,
    );

    if (!content.includes(`scope: "${signupReadRoute.scope}"`)) {
      content = replaceOnceText(
        content,
        `    const expires = request.nextUrl.searchParams.get("expires");
    const token = request.nextUrl.searchParams.get("token");

    return NextResponse.json(`,
        `    const expires = request.nextUrl.searchParams.get("expires");
    const token = request.nextUrl.searchParams.get("token");

    const blocked = await enforceRateLimit(request, {
      scope: "${signupReadRoute.scope}",
      identity: leadId || undefined,
      limit: ${signupReadRoute.limit},
      windowSeconds: 600,
    });
    if (blocked) return blocked;

    return NextResponse.json(`,
        `${signupReadRoute.file} rate call`,
      );
    }
    return content;
  });
}

// 8) Slugs canônicos e alinhamento de reservados
patch("lib/slug.ts", (content) => {
  if (!content.includes("'parceiros',")) {
    content = content.replace("  'painel',\n", "  'painel',\n  'parceiros',\n");
  }
  if (!content.includes("export function parseCanonicalPublicSlug")) {
    const marker = "\nexport function validateSubdomainSlug";
    const helper = `
export function parseCanonicalPublicSlug(value: unknown) {
  const raw = String(value || '').trim().toLowerCase()

  if (
    raw.length < 1 ||
    raw.length > 42 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(raw)
  ) {
    return null
  }

  return raw
}
`;
    content = replaceOnceText(content, marker, `${helper}${marker}`, "canonical public slug helper");
  }
  return content;
});

patch("lib/orcaly-security.ts", (content) => {
  const reserves = ["app", "dashboard", "assinatura", "site", "marketplace", "parceiros", "help", "orcaly"];
  for (const item of reserves) {
    if (!content.includes(`  '${item}',`)) {
      content = content.replace("  'admin',\n", `  'admin',\n  '${item}',\n`);
    }
  }
  return content;
});

patch("lib/payments/server-context.ts", (content) => {
  content = addImportAfter(
    content,
    'import type { NextRequest } from "next/server";\n',
    'import { parseCanonicalPublicSlug } from "@/lib/slug";',
    "server-context slug import",
  );
  content = content.replace(
    `  const clean = String(slug || "").trim().toLowerCase();

  const { data: company, error } = await supabase`,
    `  const clean = parseCanonicalPublicSlug(slug);

  if (!clean) {
    throw Object.assign(new Error("Empresa inválida."), { status: 400 });
  }

  const { data: company, error } = await supabase`,
  );
  return content;
});

patch("app/api/public-site/[slug]/route.ts", (content) => {
  if (!content.includes("assinatura_status?: string | null")) {
    content = replaceOnceText(
      content,
      "  site_delivery_options?: unknown\n}",
      `  site_delivery_options?: unknown
  assinatura_status?: string | null
  assinatura_expira_em?: string | null
  trial_started_at?: string | null
  trial_ends_at?: string | null
  cancel_at_period_end?: boolean | null
  access_until?: string | null
}`,
      "public company subscription type",
    );
  }

  content = addImportAfter(
    content,
    "import { enforceRateLimit } from '@/lib/security/rate-limit'\n",
    "import { parseCanonicalPublicSlug } from '@/lib/slug'",
    "public site slug import",
  );
  content = addImportAfter(
    content,
    "import { parseCanonicalPublicSlug } from '@/lib/slug'\n",
    "import { getCompanySubscriptionAccess } from '@/lib/subscription-access'",
    "public site subscription import",
  );
  content = addImportAfter(
    content,
    "import { getCompanySubscriptionAccess } from '@/lib/subscription-access'\n",
    "import { normalizePlanKey } from '@/lib/plans/plan-config'",
    "public site plan import",
  );

  content = content.replace(
    `    const { slug } = await context.params
    const cleanSlug = String(slug || '').trim().slice(0, 80)

    if (!cleanSlug) {`,
    `    const { slug } = await context.params
    const cleanSlug = parseCanonicalPublicSlug(slug)

    if (!cleanSlug) {`,
  );

  const fieldsAnchor = "      'ativo',\n";
  const subscriptionFields = `      'assinatura_status',
      'assinatura_plano',
      'plano',
      'assinatura_expira_em',
      'trial_started_at',
      'trial_ends_at',
      'cancel_at_period_end',
      'access_until',
`;
  if (!content.includes("'trial_ends_at'")) {
    content = content.replace(fieldsAnchor, `${subscriptionFields}${fieldsAnchor}`);
  }

  if (!content.includes("const subscriptionAccess = getCompanySubscriptionAccess(company)")) {
    content = replaceOnceText(
      content,
      `    if (
      !company ||
      company.ativo === false ||
      company.site_publico_ativo === false
    ) {
      return NextResponse.json(
        { error: 'Site nao encontrado.' },
        { status: 404 },
      )
    }

    const template =`,
      `    if (
      !company ||
      company.ativo === false ||
      company.site_publico_ativo === false
    ) {
      return NextResponse.json(
        { error: 'Site nao encontrado.' },
        { status: 404 },
      )
    }

    const subscriptionAccess = getCompanySubscriptionAccess(company)
    if (!subscriptionAccess.hasAccess) {
      return NextResponse.json(
        { error: 'Site nao encontrado.' },
        { status: 404 },
      )
    }

    const template =`,
      "public site subscription gate",
    );
  }

  if (!content.includes("const onlinePaymentsAllowed")) {
    content = replaceOnceText(
      content,
      `    const setting = paymentSettingsResult.error
      ? null
      : paymentSettingsResult.data
    const connected = Boolean(
      setting?.is_active === true &&
        setting?.onboarding_status === 'connected' &&
        setting?.public_key,
    )`,
      `    const setting = paymentSettingsResult.error
      ? null
      : paymentSettingsResult.data
    const publicPlan = normalizePlanKey(
      company.assinatura_plano || company.plano,
    )
    const onlinePaymentsAllowed =
      publicPlan === 'profissional' || publicPlan === 'premium'
    const connected =
      onlinePaymentsAllowed &&
      Boolean(
        setting?.is_active === true &&
          setting?.onboarding_status === 'connected' &&
          setting?.public_key,
      )`,
      "public site online payments plan gate",
    );
  }

  // Não publica itens explicitamente indisponíveis/inativos.
  content = content.replace(
    `    const products =
      (rawProducts || []) as unknown as PublicProductRow[]`,
    `    const products =
      ((rawProducts || []) as unknown as PublicProductRow[]).filter(
        (product) =>
          product.ativo !== false &&
          product.is_active !== false &&
          product.available !== false,
      )`,
  );
  return content;
});

patch("app/api/public/uploads/art/route.ts", (content) => {
  content = addImportAfter(
    content,
    "import { enforceRateLimit } from '@/lib/security/rate-limit'\n",
    "import { parseCanonicalPublicSlug } from '@/lib/slug'",
    "art slug import",
  );
  content = content.replace(
    `    const file = form.get('file')
    const slug = String(form.get('slug') || '').trim().slice(0, 80)

    if (!(file instanceof File) || !slug) {`,
    `    const file = form.get('file')
    const slug = parseCanonicalPublicSlug(form.get('slug'))

    if (!(file instanceof File) || !slug) {`,
  );
  return content;
});

// 8.1) APIs financeiras e IA interna respeitam cargo/assinatura.
for (const financeRoute of [
  "app/api/marketplace/payments/settings/route.ts",
  "app/api/marketplace/payments/sales/route.ts",
]) {
  patch(financeRoute, (content) => {
    content = content.replace(
      "import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
      "import { assinaturaEstaAtiva, companyPlanAllows, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
    );

    if (!content.includes("companyPlanAllows(access.company, 'profissional')")) {
      content = content.replace(
        `    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
`,
        `    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (
      !assinaturaEstaAtiva(access.company) ||
      !companyPlanAllows(access.company, 'profissional')
    ) {
      return NextResponse.json(
        { error: 'Recurso disponível a partir do plano Profissional com assinatura ativa.' },
        { status: 403 },
      )
    }
`,
      );
    }

    if (!content.includes("if (!access.canFinance)")) {
      content = content.replace(
        `    if (
      !assinaturaEstaAtiva(access.company) ||
      !companyPlanAllows(access.company, 'profissional')
    ) {
      return NextResponse.json(
        { error: 'Recurso disponível a partir do plano Profissional com assinatura ativa.' },
        { status: 403 },
      )
    }
`,
        `    if (
      !assinaturaEstaAtiva(access.company) ||
      !companyPlanAllows(access.company, 'profissional')
    ) {
      return NextResponse.json(
        { error: 'Recurso disponível a partir do plano Profissional com assinatura ativa.' },
        { status: 403 },
      )
    }
    if (!access.canFinance) {
      return NextResponse.json(
        { error: 'Seu perfil não possui acesso financeiro.' },
        { status: 403 },
      )
    }
`,
      );
    }
    return content;
  });
}


for (const crmRoute of [
  "app/api/crm/leads/route.ts",
  "app/api/crm/leads/[id]/route.ts",
]) {
  patch(crmRoute, (content) => {
    content = content.replace(
      "import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
      "import { assinaturaEstaAtiva, companyPlanAllows, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
    );
    if (!content.includes("@/lib/security/request")) {
      const firstImportEnd = content.indexOf("\n", content.indexOf("from '@/lib/orcaly-audit'"));
      if (firstImportEnd < 0) throw new Error(`Import anchor ausente em ${crmRoute}`);
      content =
        content.slice(0, firstImportEnd + 1) +
        "import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'\n" +
        content.slice(firstImportEnd + 1);
    }

    if (!content.includes("companyPlanAllows(companyAccess.company, 'profissional')")) {
      content = replaceOnceText(
        content,
        `  if (!companyAccess.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  return { supabaseAdmin, requester, companyAccess }`,
        `  if (!companyAccess.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  if (
    !assinaturaEstaAtiva(companyAccess.company) ||
    !companyPlanAllows(companyAccess.company, 'profissional')
  ) {
    return {
      supabaseAdmin,
      error: NextResponse.json(
        { error: 'CRM disponível a partir do plano Profissional com assinatura ativa.' },
        { status: 403 },
      ),
    }
  }

  if (!companyAccess.canProposal) {
    return {
      supabaseAdmin,
      error: NextResponse.json(
        { error: 'Seu perfil não possui acesso ao CRM.' },
        { status: 403 },
      ),
    }
  }

  return { supabaseAdmin, requester, companyAccess }`,
        `crm access gate ${crmRoute}`,
      );
    }

    content = content.replace(
      "    const body = await request.json()",
      "    const body = await readJsonBody<Record<string, unknown>>(request, 24 * 1024)",
    );

    content = content.replaceAll(
      `  } catch (error) {
    const message =`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    const message =`,
    );
    return content;
  });
}

patch("app/api/ai/orcamento/route.ts", (content) => {
  content = content.replace(
    "import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
    "import { assinaturaEstaAtiva, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
  );
  content = addImportAfter(
    content,
    "import { assinaturaEstaAtiva, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'\n",
    "import { normalizePlanKey } from '@/lib/plans/plan-config'",
    "orcamento AI plan import",
  );

  if (!content.includes("if (!assinaturaEstaAtiva(access.company))")) {
    content = replaceOnceText(
      content,
      `    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const plan = String(
      access.company.assinatura_plano ||
        access.company.plano ||
        'basico',
    ).toLowerCase()`,
      `    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!assinaturaEstaAtiva(access.company)) {
      return NextResponse.json(
        { error: 'Assinatura sem acesso ativo.' },
        { status: 403 },
      )
    }

    const plan = normalizePlanKey(
      access.company.assinatura_plano ||
        access.company.plano ||
        'essencial',
    )`,
      "orcamento AI subscription plan",
    );
  }
  content = content.replace("const body = await readJsonBody<any>(request, 16 * 1024)", "const body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024)");
  return content;
});

patch("app/api/marketplace/coupon/route.ts", (content) => {
  content = addImportAfter(
    content,
    "import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'\n",
    "import { parseCanonicalPublicSlug } from '@/lib/slug'",
    "coupon slug import",
  );
  content = content.replace(
    "const body = await readJsonBody<any>(request, 64 * 1024)",
    "const body = await readJsonBody<Record<string, unknown>>(request, 64 * 1024)",
  );
  content = content.replace(
    "    const slug = String(body.slug || '').trim()",
    "    const slug = parseCanonicalPublicSlug(body.slug)",
  );
  return content;
});

// 8.2) OAuth Mercado Pago: consumo atomico de state e protecao contra replay.
patch("app/api/marketplace/payments/mercado-pago/callback/route.ts", (content) => {
  if (!content.includes("let validatedCompanyId: string | null = null;")) {
    content = content.replace(
      `export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();`,
      `export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  let validatedCompanyId: string | null = null;`,
    );
  }

  if (!content.includes("const { data: claimedState")) {
    content = replaceOnceText(
      content,
      `    if (!oauthState?.company_id) {
      throw new Error(
        "State OAuth invalido, expirado ou ja utilizado.",
      );
    }

    const tokenPayload = await exchangeMercadoPagoCode(`,
      `    if (!oauthState?.company_id) {
      throw new Error(
        "State OAuth invalido, expirado ou ja utilizado.",
      );
    }

    const claimedAt = new Date().toISOString();
    const { data: claimedState, error: claimError } =
      await supabaseAdmin
        .from("marketplace_oauth_states")
        .update({ consumed_at: claimedAt })
        .eq("id", oauthState.id)
        .is("consumed_at", null)
        .gt("expires_at", claimedAt)
        .select("id,company_id")
        .maybeSingle();

    if (claimError) throw claimError;
    if (!claimedState?.id || !claimedState.company_id) {
      throw new Error(
        "State OAuth invalido, expirado ou ja utilizado.",
      );
    }

    validatedCompanyId = String(claimedState.company_id);

    const tokenPayload = await exchangeMercadoPagoCode(`,
      "atomic oauth state claim",
    );
  }

  // Usa apenas a empresa do state atomically claimed.
  content = content.replaceAll("oauthState.company_id", "validatedCompanyId");

  // O state ja foi consumido atomicamente; remove o update tardio.
  content = content.replace(
    `    await supabaseAdmin
      .from("marketplace_oauth_states")
      .update({
        consumed_at: new Date().toISOString(),
      })
      .eq("id", oauthState.id);

`,
    "",
  );

  // Catch nunca pesquisa um state arbitrario/reutilizado.
  content = replaceOnceRegex(
    content,
    /    if \(state\) \{[\s\S]*?    \}\n\n    return NextResponse\.redirect\(/,
    `    if (validatedCompanyId) {
      await supabaseAdmin
        .from("marketplace_payment_settings")
        .upsert(
          {
            company_id: validatedCompanyId,
            provider: "mercado_pago",
            onboarding_status: "error",
            account_status: "error",
            is_active: false,
            charges_enabled: false,
            pix_enabled: false,
            card_enabled: false,
            last_status_check_at: new Date().toISOString(),
            last_error: message.slice(0, 500),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,provider" },
        );
    }

    return NextResponse.redirect(`,
    "oauth catch only validated state",
  );

  return content;
});

patch("app/api/marketplace/payments/mercado-pago/connect/route.ts", (content) => {
  content = content.replace(
    `  getCompanyAccess,
  getRequester,
  getSupabaseAdmin,`,
    `  assinaturaEstaAtiva,
  companyPlanAllows,
  getCompanyAccess,
  getRequester,
  getSupabaseAdmin,`,
  );
  content = addImportAfter(
    content,
    '} from "@/lib/company-access";\n',
    'import { enforceRateLimit } from "@/lib/security/rate-limit";',
    "mp connect rate import",
  );
  if (!content.includes("if (!assinaturaEstaAtiva(access.company))")) {
    content = replaceOnceText(
      content,
      `    if (!access.company?.id) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 },
      );
    }

    if (!access.canConfig && !access.canFinance) {`,
      `    if (!access.company?.id) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 },
      );
    }

    if (
      !assinaturaEstaAtiva(access.company) ||
      !companyPlanAllows(access.company, "profissional")
    ) {
      return NextResponse.json(
        { error: "Pagamentos online exigem plano Profissional ou Premium com assinatura ativa." },
        { status: 403 },
      );
    }

    if (!access.canConfig && !access.canFinance) {`,
      "mp connect subscription gate",
    );
  }
  if (!content.includes('scope: "marketplace-mp-connect"')) {
    content = replaceOnceText(
      content,
      `    if (!access.canConfig && !access.canFinance) {
      return NextResponse.json(
        {
          error:
            "Sem permissao para configurar pagamentos.",
        },
        { status: 403 },
      );
    }

    const oauth = generateMercadoPagoOauthFlow();`,
      `    if (!access.canConfig && !access.canFinance) {
      return NextResponse.json(
        {
          error:
            "Sem permissao para configurar pagamentos.",
        },
        { status: 403 },
      );
    }

    const blocked = await enforceRateLimit(request, {
      scope: "marketplace-mp-connect",
      identity: requester.id,
      limit: 10,
      windowSeconds: 3600,
    });
    if (blocked) return blocked;

    const oauth = generateMercadoPagoOauthFlow();`,
      "mp connect rate limit",
    );
  }
  return content;
});

// 9) Storage interno: SVG não sanitizado deixa de ser aceito
patch("lib/panel-storage.ts", (content) => {
  content = content.replace(
    "    mimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'],",
    "    mimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],",
  );
  content = content.replace(
    "    extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'],",
    "    extensions: ['png', 'jpg', 'jpeg', 'webp'],",
  );
  return content;
});

// 10) Limites de corpo compartilhados
patch("lib/security/request.ts", (content) => {
  if (!content.includes("export async function readTextBody")) {
    const marker = "\nexport async function readJsonBody";
    const helper = `
export async function readTextBody(
  request: NextRequest,
  maxBytes: number,
): Promise<string> {
  const declared = Number(request.headers.get('content-length') || 0)

  if (declared > maxBytes) {
    throw new RequestBodyError('Requisicao muito grande.', 413)
  }

  const buffer = await request.arrayBuffer()

  if (buffer.byteLength > maxBytes) {
    throw new RequestBodyError('Requisicao muito grande.', 413)
  }

  return new TextDecoder().decode(buffer)
}
`;
    content = replaceOnceText(content, marker, `${helper}${marker}`, "readTextBody");
    content = content.replace(
      `  const declared = Number(request.headers.get('content-length') || 0)

  if (declared > maxBytes) {
    throw new RequestBodyError('Requisicao muito grande.', 413)
  }

  const buffer = await request.arrayBuffer()

  if (buffer.byteLength > maxBytes) {
    throw new RequestBodyError('Requisicao muito grande.', 413)
  }

  try {
    return JSON.parse(new TextDecoder().decode(buffer) || '{}') as T`,
      `  const raw = await readTextBody(request, maxBytes)

  try {
    return JSON.parse(raw || '{}') as T`,
    );
  }
  return content;
});

// Home AI: se rate limit cair, usa resposta guiada sem gastar modelo.
patch("app/api/public/home-chat/route.ts", (content) => {
  content = addImportAfter(
    content,
    "import { enforceRateLimit } from '@/lib/security/rate-limit'\n",
    "import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'",
    "home AI body import",
  );

  content = replaceOnceRegex(
    content,
    /export async function POST\(request: NextRequest\) \{[\s\S]*\n\}\s*$/,
    `export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      question?: unknown
      messages?: unknown
    }>(request, 20 * 1024)
    const question = cleanText(body.question, 700)
    const messages = normalizeMessages(body.messages)

    if (question.length < 2) {
      return NextResponse.json(
        { error: 'Digite uma pergunta.' },
        { status: 400 },
      )
    }

    const limited = await enforceRateLimit(request, {
      scope: 'public-home-ai-chat-v2',
      limit: 24,
      windowSeconds: 600,
    })

    if (limited) {
      if (limited.status === 429) return limited

      const fallback = guidedAnswer(question)
      return NextResponse.json({
        ...fallback,
        source: 'guided-protection',
      })
    }

    const aiResult = await generateAnswer(question, messages)

    if (aiResult) {
      return NextResponse.json({
        answer: aiResult.answer,
        suggestions: aiResult.suggestions,
        action: aiResult.action,
        source: 'ai',
      })
    }

    const fallback = guidedAnswer(question)

    return NextResponse.json({
      ...fallback,
      source: 'guided',
    })
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(
      { error: 'Não foi possível processar a pergunta.' },
      { status: 400 },
    )
  }
}`,
    "home AI fail closed with guided fallback",
  );
  return content;
});

// Internal AI: plano normalizado + assinatura ativa.
patch("app/api/ai/business-assistant/route.ts", (content) => {
  content = content.replace(
    "import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
    "import { assinaturaEstaAtiva, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
  );
  content = addImportAfter(
    content,
    "import { assinaturaEstaAtiva, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'\n",
    "import { normalizePlanKey } from '@/lib/plans/plan-config'",
    "business AI plan import",
  );
  if (!content.includes("if (!assinaturaEstaAtiva(access.company))")) {
    content = replaceOnceText(
      content,
      `    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const plan = String(
      access.company.assinatura_plano ||
        access.company.plano ||
        'basico',
    ).toLowerCase()`,
      `    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    if (!assinaturaEstaAtiva(access.company)) {
      return NextResponse.json(
        { error: 'Assinatura sem acesso ativo.' },
        { status: 403 },
      )
    }

    const plan = normalizePlanKey(
      access.company.assinatura_plano ||
        access.company.plano ||
        'essencial',
    )`,
      "business AI subscription + plan",
    );
  }
  return content;
});

// 11) Webhooks com byte limit
patch("app/api/mercado-pago/webhook/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { NextRequest, NextResponse } from "next/server";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "subscription webhook body import",
  );
  content = content.replace(
    `    const body = record(
      await request.json().catch(() => ({})),
    );`,
    `    const body = record(
      await readJsonBody<JsonRecord>(request, 64 * 1024),
    );`,
  );
  if (!content.includes("const bodyError = requestBodyErrorResponse(error);")) {
    content = content.replace(
      `  } catch (error) {
    const message =`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    const message =`,
    );
  }
  return content;
});

patch("app/api/assinatura/checkout/webhook/route.ts", (content) => {
  content = addImportAfter(
    content,
    "import { getSubscriptionWebhookSecret } from '@/lib/payments/subscription/mercado-pago'\n",
    "import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'",
    "checkout webhook body import",
  );
  content = content.replace(
    `    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>`,
    `    const body = await readJsonBody<Record<string, unknown>>(
      request,
      64 * 1024,
    )`,
  );
  if (!content.includes("const bodyError = requestBodyErrorResponse(error)")) {
    content = content.replace(
      `  } catch (error) {
    console.error(`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    console.error(`,
    );
  }
  return content;
});

patch("app/api/mercado-pago/webhook-leads/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { NextRequest, NextResponse } from "next/server";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "lead webhook body import",
  );
  content = replaceOnceRegex(
    content,
    /export async function POST\(request: NextRequest\) \{[\s\S]*\n\}\s*$/,
    `export async function POST(request: NextRequest) {
  try {
    let paymentId = getPaymentIdFromUrl(request);

    if (!paymentId) {
      const body = await readJsonBody<{
        data?: { id?: unknown };
        id?: unknown;
        payment_id?: unknown;
      }>(request, 64 * 1024);

      paymentId = String(
        body?.data?.id || body?.id || body?.payment_id || "",
      );
    }

    const valid = verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: String(paymentId || "") || null,
      secret: getSignupWebhookSecret(),
    });

    if (!valid) {
      return NextResponse.json(
        { error: "Assinatura inválida." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      await processPayment(String(paymentId || "")),
    );
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    console.error(
      "orcaly_signup_webhook_error",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Não foi possível processar o webhook." },
      { status: 500 },
    );
  }
}`,
    "signup webhook bounded body",
  );
  return content;
});

patch("app/api/webhooks/asaas/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { NextRequest, NextResponse } from "next/server";\n',
    'import { readTextBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "asaas body import",
  );
  content = content.replace(
    `    const rawText = await request.text();`,
    `    const rawText = await readTextBody(request, 128 * 1024);`,
  );
  if (!content.includes("const bodyError = requestBodyErrorResponse(error);")) {
    content = content.replace(
      `  } catch (error) {
    console.error("[Orcaly financeiro] Falha no webhook:",`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    console.error("[Orcaly financeiro] Falha no webhook:",`,
    );
  }
  return content;
});

// Marketplace Mercado Pago: assinatura obrigatória, body limitado e payload sanitizado.
patch("app/api/marketplace/payments/webhook/mercado-pago/route.ts", (content) => {
  content = addImportAfter(
    content,
    "import { getSupabaseAdmin } from '@/lib/company-access'\n",
    "import { cleanSensitivePayload } from '@/lib/payments/server-context'",
    "marketplace webhook sanitize import",
  );
  content = addImportAfter(
    content,
    "import { cleanSensitivePayload } from '@/lib/payments/server-context'\n",
    "import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'",
    "marketplace webhook body import",
  );

  content = replaceOnceText(
    content,
    `export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const url = new URL(request.url)
  const body = await request.json().catch(() => ({}))
  const paymentId = extractPaymentId(body, url)
  const marketplacePaymentIdFromUrl = String(
    url.searchParams.get('marketplace_payment_id') || '',
  )
  const companyIdFromUrl = String(
    url.searchParams.get('company_id') || '',
  )

  try {
    const secret = getMarketplaceWebhookSecret()`,
    `export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const url = new URL(request.url)
  let body: Record<string, unknown> = {}
  const marketplacePaymentIdFromUrl = String(
    url.searchParams.get('marketplace_payment_id') || '',
  )
  const companyIdFromUrl = String(
    url.searchParams.get('company_id') || '',
  )

  try {
    body = await readJsonBody<Record<string, unknown>>(
      request,
      64 * 1024,
    )
    const paymentId = extractPaymentId(body, url)
    const secret = getMarketplaceWebhookSecret()`,
    "marketplace webhook bounded body",
  );

  content = replaceOnceText(
    content,
    `    if (!xSignature || !xRequestId) {
      return NextResponse.json({
        ok: true,
        ignored: 'Notificacao legada sem assinatura.',
      })
    }`,
    `    if (!xSignature || !xRequestId) {
      return NextResponse.json(
        { error: 'Assinatura obrigatoria ausente.' },
        { status: 401 },
      )
    }`,
    "marketplace webhook unsigned rejection",
  );

  content = content.replace(
    "          raw_payload: mpPayment,",
    "          raw_payload: cleanSensitivePayload(mpPayment),",
  );
  content = content.replace(
    "          raw_payload: body,",
    "          raw_payload: cleanSensitivePayload(body),",
  );

  if (!content.includes("const bodyError = requestBodyErrorResponse(error)")) {
    content = content.replace(
      `  } catch (error) {
    if (marketplacePaymentIdFromUrl && companyIdFromUrl) {`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    if (marketplacePaymentIdFromUrl && companyIdFromUrl) {`,
    );
  }

  return content;
});

// Checkout avulso da assinatura: body limitado e nunca persiste payload financeiro cru.
patch("lib/subscription-checkout-payment.ts", (content) => {
  content = addImportAfter(
    content,
    'import type { NextRequest } from "next/server";\n',
    'import { readJsonBody } from "@/lib/security/request";',
    "subscription checkout body import",
  );
  content = addImportAfter(
    content,
    'import { readJsonBody } from "@/lib/security/request";\n',
    'import { cleanSensitivePayload } from "@/lib/payments/server-context";',
    "subscription checkout sanitize import",
  );

  content = content.replace(
    `  const body = (await request.json().catch(() => ({}))) as JsonRecord;`,
    `  const body = await readJsonBody<JsonRecord>(request, 32 * 1024);`,
  );

  content = content.replaceAll(
    "        raw_payment: payment,",
    "        raw_payment: cleanSensitivePayload(payment),",
  );
  content = content.replaceAll(
    "            raw_payment: payment,",
    "            raw_payment: cleanSensitivePayload(payment),",
  );
  return content;
});


// Idempotência de pagamento avulso de assinatura: o cliente reutiliza a chave
// após falha de rede e o servidor exige UUID para impedir duplicidade acidental.
patch("components/subscription/MercadoPagoSubscriptionCheckout.tsx", (content) => {
  if (!content.includes("oneTimeIdempotencyRef")) {
    content = replaceOnceText(
      content,
      `  const brickControllerRef = useRef<any>(null);
  const processingRef = useRef(false);`,
      `  const brickControllerRef = useRef<any>(null);
  const processingRef = useRef(false);
  const oneTimeIdempotencyRef = useRef("");`,
      "subscription idempotency ref",
    );
  }

  content = replaceOnceText(
    content,
    `        const response = await fetchWithPaymentTimeout("/api/assinatura/checkout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: \`Bearer \${token}\`,
            "x-orcaly-session": token,
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            plan: planKey,
            formData,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.error || "Não foi possível processar o pagamento.",
          );
        }`,
    `        const idempotencyKey =
          oneTimeIdempotencyRef.current || crypto.randomUUID();
        oneTimeIdempotencyRef.current = idempotencyKey;

        const response = await fetchWithPaymentTimeout("/api/assinatura/checkout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: \`Bearer \${token}\`,
            "x-orcaly-session": token,
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({
            plan: planKey,
            formData,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status < 500) {
            oneTimeIdempotencyRef.current = "";
          }
          throw new Error(
            payload.error || "Não foi possível processar o pagamento.",
          );
        }

        oneTimeIdempotencyRef.current = "";`,
    "subscription checkout retry idempotency",
  );
  return content;
});

patch("lib/subscription-checkout-payment.ts", (content) => {
  content = content.replace(
    'import { randomUUID } from "node:crypto";\n',
    "",
  );

  if (!content.includes("idempotency-key inválida")) {
    content = replaceOnceText(
      content,
      `  if (!context.canManage) {
    throw Object.assign(
      new Error("Você não possui permissão para pagar a assinatura."),
      { status: 403 },
    );
  }

  const body = await readJsonBody<JsonRecord>(request, 32 * 1024);`,
      `  if (!context.canManage) {
    throw Object.assign(
      new Error("Você não possui permissão para pagar a assinatura."),
      { status: 403 },
    );
  }

  const idempotencyKey = text(
    request.headers.get("idempotency-key"),
  );
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idempotencyKey,
    )
  ) {
    throw Object.assign(
      new Error("Chave de idempotência do pagamento inválida."),
      { status: 400 },
    );
  }

  const body = await readJsonBody<JsonRecord>(request, 32 * 1024);`,
      "subscription require idempotency key",
    );
  }

  content = content.replace(
    `  const idempotencyKey =
    text(request.headers.get("idempotency-key")) || randomUUID();`,
    "",
  );

  if (!content.includes("existingPaymentRow")) {
    content = replaceOnceText(
      content,
      `  const { data: paymentRow, error: paymentError } =
    await context.admin
      .from("plan_payments")
      .insert({
        company_id: companyId,
        plano: planKey,
        valor: plan.price,
        status: "created",
        tipo: kind === "pix" ? "pix_avulso" : "card_avulso",
        payment_method: paymentMethodId,
        email: payerEmail,
        nome_empresa: text(company.nome) || "Empresa",
      })
      .select("id")
      .single();

  if (paymentError || !paymentRow?.id) {
    throw Object.assign(
      new Error(
        paymentError?.message ||
          "Não foi possível preparar o pagamento.",
      ),
      { status: 500 },
    );
  }`,
      `  const { data: existingPaymentRow, error: existingPaymentError } =
    await context.admin
      .from("plan_payments")
      .select("*")
      .eq("company_id", companyId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

  if (existingPaymentError) throw existingPaymentError;

  let paymentRow = existingPaymentRow as JsonRecord | null;

  if (paymentRow?.mercado_pago_payment_id) {
    const existingPayment = (await getMercadoPagoPayment(
      getPlatformAccessToken(),
      text(paymentRow.mercado_pago_payment_id),
    )) as JsonRecord;

    return persistRemoteStatus(
      context.admin,
      paymentRow,
      company,
      existingPayment,
    );
  }

  if (!paymentRow) {
    const inserted = await context.admin
      .from("plan_payments")
      .insert({
        company_id: companyId,
        plano: planKey,
        valor: plan.price,
        status: "created",
        tipo: kind === "pix" ? "pix_avulso" : "card_avulso",
        payment_method: paymentMethodId,
        provider: "mercado_pago",
        idempotency_key: idempotencyKey,
        email: payerEmail,
        nome_empresa: text(company.nome) || "Empresa",
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data?.id) {
      throw Object.assign(
        new Error(
          inserted.error?.message ||
            "Não foi possível preparar o pagamento.",
        ),
        { status: 500 },
      );
    }

    paymentRow = inserted.data as JsonRecord;
  }`,
      "subscription one-time idempotent row reuse",
    );

    content = content.replace(
      `  const paymentRowId = text(paymentRow.id);`,
      `  const paymentRowId = text(paymentRow.id);`,
    );
  }

  content = replaceOnceText(
    content,
    `  } catch (error) {
    await context.admin
      .from("plan_payments")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRowId)
      .eq("company_id", companyId);

    throw error;
  }`,
    `  } catch (error) {
    const providerStatus =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status || 0)
        : 0;

    await context.admin
      .from("plan_payments")
      .update({
        status:
          providerStatus >= 400 && providerStatus < 500
            ? "failed"
            : "creating",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRowId)
      .eq("company_id", companyId);

    throw error;
  }`,
    "subscription one-time ambiguous provider result",
  );
  return content;
});


// Assinatura recorrente transparente: body limitado, idempotência e payload sanitizado.
patch("lib/subscription-mercado-pago-transparent.ts", (content) => {
  content = addImportAfter(
    content,
    'import type { NextRequest } from "next/server";\n',
    'import { readJsonBody } from "@/lib/security/request";',
    "transparent subscription body import",
  );
  content = addImportAfter(
    content,
    'import { readJsonBody } from "@/lib/security/request";\n',
    'import { cleanSensitivePayload } from "@/lib/payments/server-context";',
    "transparent subscription sanitize import",
  );

  content = content.replace(
    `  const body = (await request
    .json()
    .catch(() => ({}))) as JsonRecord;`,
    `  const idempotencyKey = text(
    request.headers.get("idempotency-key"),
  );
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idempotencyKey,
    )
  ) {
    throw Object.assign(
      new Error("Chave de idempotência da assinatura inválida."),
      { status: 400 },
    );
  }

  const body = await readJsonBody<JsonRecord>(
    request,
    24 * 1024,
  );`,
  );

  content = replaceOnceText(
    content,
    `        provider: "mercado_pago",
        email: payerEmail,`,
    `        provider: "mercado_pago",
        idempotency_key: idempotencyKey,
        email: payerEmail,`,
    "transparent subscription idempotency persistence",
  );

  content = content.replaceAll(
    "        raw_subscription: subscription,",
    "        raw_subscription: cleanSensitivePayload(subscription),",
  );
  content = content.replace(
    "    assinatura_mp_payload: subscription,",
    "    assinatura_mp_payload: cleanSensitivePayload(subscription),",
  );
  return content;
});

patch("components/subscription/MercadoPagoSubscriptionCheckout.tsx", (content) => {
  if (!content.includes("recurringIdempotencyRef")) {
    content = replaceOnceText(
      content,
      `  const processingRef = useRef(false);
  const oneTimeIdempotencyRef = useRef("");`,
      `  const processingRef = useRef(false);
  const oneTimeIdempotencyRef = useRef("");
  const recurringIdempotencyRef = useRef("");`,
      "recurring idempotency ref",
    );
  }

  content = replaceOnceText(
    content,
    `          const response = await fetchWithPaymentTimeout(
            "/api/assinatura/mercado-pago",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: \`Bearer \${token}\`,
            "x-orcaly-session": token,
              },
              body: JSON.stringify({
                plan: planKey,
                cardTokenId: formData.token,
                payerEmail:
                  payer.email ||
                  snapshot?.company?.email ||
                  "",
              }),
            },
          );
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {`,
    `          const idempotencyKey =
            recurringIdempotencyRef.current || crypto.randomUUID();
          recurringIdempotencyRef.current = idempotencyKey;

          const response = await fetchWithPaymentTimeout(
            "/api/assinatura/mercado-pago",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: \`Bearer \${token}\`,
                "x-orcaly-session": token,
                "idempotency-key": idempotencyKey,
              },
              body: JSON.stringify({
                plan: planKey,
                cardTokenId: formData.token,
                payerEmail:
                  payer.email ||
                  snapshot?.company?.email ||
                  "",
              }),
            },
          );
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            if (response.status < 500) {
              recurringIdempotencyRef.current = "";
            }`,
    "recurring checkout retry idempotency",
  );
  return content;
});

// Endpoint de gerenciamento de assinatura também passa pelo byte-limit compartilhado.
patch("app/api/company/subscription/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { NextRequest, NextResponse } from "next/server";\n',
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";',
    "company subscription body import",
  );
  content = content.replace(
    `    const body = await request.json().catch(() => ({}));`,
    `    const body = await readJsonBody<Record<string, unknown>>(
      request,
      16 * 1024,
    );`,
  );
  if (!content.includes("const bodyError = requestBodyErrorResponse(error);")) {
    content = content.replace(
      `  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerenciar assinatura.";`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    const message = error instanceof Error ? error.message : "Erro ao gerenciar assinatura.";`,
    );
  }
  return content;
});

// Payloads de assinatura guardados no banco ficam sanitizados.
patch("app/api/mercado-pago/webhook/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";\n',
    'import { cleanSensitivePayload } from "@/lib/payments/server-context";',
    "subscription webhook sanitize import",
  );
  content = content.replace(
    "      assinatura_mp_payload: subscription,",
    "      assinatura_mp_payload: cleanSensitivePayload(subscription),",
  );
  content = content.replace(
    "        raw_webhook: body,",
    "        raw_webhook: cleanSensitivePayload(body),",
  );
  content = content.replace(
    "        raw_payment: payment,",
    "        raw_payment: cleanSensitivePayload(payment),",
  );
  return content;
});

patch("app/api/mercado-pago/webhook-leads/route.ts", (content) => {
  content = addImportAfter(
    content,
    'import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";\n',
    'import { cleanSensitivePayload } from "@/lib/payments/server-context";',
    "signup webhook sanitize import",
  );
  content = content.replace(
    "      mercado_pago_payment: payment,",
    "      mercado_pago_payment: cleanSensitivePayload(payment),",
  );
  return content;
});

patch("lib/subscription-service.ts", (content) => {
  content = addImportAfter(
    content,
    'import { createClient } from "@supabase/supabase-js";\n',
    'import { cleanSensitivePayload } from "@/lib/payments/server-context";',
    "subscription service sanitize import",
  );
  content = content.replace(
    "      raw_subscription: subscription,",
    "      raw_subscription: cleanSensitivePayload(subscription),",
  );
  content = content.replace(
    "      assinatura_mp_payload: subscription,",
    "      assinatura_mp_payload: cleanSensitivePayload(subscription),",
  );
  content = content.replace(
    "      raw_preference: preference,",
    "      raw_preference: cleanSensitivePayload(preference),",
  );
  content = content.replace(
    "      assinatura_mp_payload: remoteSubscription || company.assinatura_mp_payload || null,",
    "      assinatura_mp_payload: remoteSubscription ? cleanSensitivePayload(remoteSubscription) : company.assinatura_mp_payload || null,",
  );
  return content;
});

// 12) Subscription sync/history com permissão
patch("lib/subscription-service.ts", (content) => {
  content = content.replace(
    `  const history = await getHistory(context.admin, context.company.id);
  return {
    company: safeCompany(context.company),
    role: context.role,
    can_manage: context.canManage,
    plans: ORCALY_PLANS,
    history,
  };`,
    `  const history = context.canManage
    ? await getHistory(context.admin, context.company.id)
    : { events: [], payments: [] };
  return {
    company: safeCompany(context.company),
    role: context.role,
    can_manage: context.canManage,
    plans: ORCALY_PLANS,
    history,
  };`,
  );
  if (!content.includes('if (!context.canManage) throw new Error("Você não possui permissão para sincronizar a assinatura.");')) {
    content = replaceOnceText(
      content,
      `  if (!context.user) throw new Error("Não autorizado.");
  if (!company?.id) throw new Error("Empresa não encontrada.");

  const preapprovalId =`,
      `  if (!context.user) throw new Error("Não autorizado.");
  if (!company?.id) throw new Error("Empresa não encontrada.");
  if (!context.canManage) {
    throw new Error("Você não possui permissão para sincronizar a assinatura.");
  }

  const preapprovalId =`,
      "subscription sync authorization",
    );
  }
  return content;
});

// 13) Admin scanner: cron autenticado e permissão real
patch("lib/platform-admin.ts", (content) => {
  if (!content.includes("| 'system.scan'")) {
    content = content.replace(
      "  | 'settings.manage'\n",
      "  | 'settings.manage'\n  | 'system.scan'\n",
    );
  }
  if (!content.includes("key: 'system.scan'")) {
    const anchor = `  {
    key: 'settings.manage',
    label: 'Alterar configurações',
    description: 'Modificar regras críticas da plataforma.',
    supportAssignable: false,
  },
]`;
    const replacement = `  {
    key: 'settings.manage',
    label: 'Alterar configurações',
    description: 'Modificar regras críticas da plataforma.',
    supportAssignable: false,
  },
  {
    key: 'system.scan',
    label: 'Executar scanner',
    description: 'Executar varreduras administrativas e de consistência.',
    supportAssignable: false,
  },
]`;
    content = replaceOnceText(content, anchor, replacement, "platform system.scan catalog");
  }
  if (!content.includes("  'system.scan',\n])")) {
    content = content.replace(
      "  'settings.manage',\n])",
      "  'settings.manage',\n  'system.scan',\n])",
    );
  }

  if (!content.includes("const adminFields =")) {
    content = replaceOnceText(
      content,
      `  const email = requester.email.toLowerCase()
  const { data: admin, error } = await supabaseAdmin
    .from('platform_admins')
    .select(
      'id,user_id,email,role,is_active,nome,permissions,area,observacoes,last_login_at,must_change_password',
    )
    .or(
      \`user_id.eq.\${requester.id},email.ilike.\${email}\`,
    )
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error || !admin) return null`,
      `  const email = requester.email.toLowerCase()
  const adminFields =
    'id,user_id,email,role,is_active,nome,permissions,area,observacoes,last_login_at,must_change_password'

  const byUser = await supabaseAdmin
    .from('platform_admins')
    .select(adminFields)
    .eq('user_id', requester.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  let admin = byUser.data
  let lookupError = byUser.error

  if (!admin && !lookupError) {
    const byEmail = await supabaseAdmin
      .from('platform_admins')
      .select(adminFields)
      .ilike('email', email)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    admin = byEmail.data
    lookupError = byEmail.error
  }

  if (lookupError || !admin) return null`,
      "platform admin identity without interpolated or",
    );
  }

  if (!content.includes("const shouldRefreshLogin")) {
    content = replaceOnceText(
      content,
      `  const patch: Record<string, unknown> = {
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (!admin.user_id) {
    patch.user_id = requester.id
  }

  await supabaseAdmin
    .from('platform_admins')
    .update(patch)
    .eq('id', admin.id)

  return resolved`,
      `  const lastLoginAt = admin.last_login_at
    ? new Date(String(admin.last_login_at)).getTime()
    : 0
  const shouldRefreshLogin =
    !lastLoginAt ||
    Date.now() - lastLoginAt > 5 * 60 * 1000 ||
    !admin.user_id

  if (shouldRefreshLogin) {
    const patch: Record<string, unknown> = {
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (!admin.user_id) {
      patch.user_id = requester.id
    }

    await supabaseAdmin
      .from('platform_admins')
      .update(patch)
      .eq('id', admin.id)
  }

  return resolved`,
      "platform admin login write throttle",
    );
  }

  return content;
});

patch("app/api/admin/scan/route.ts", (content) => {
  if (!content.startsWith("import { timingSafeEqual")) {
    content = `import { timingSafeEqual } from 'node:crypto'\n${content}`;
  }
  if (!content.includes("function isCronRequest(")) {
    const marker = "\nexport async function GET(request: NextRequest)";
    const helper = `
function isCronRequest(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || '')
  const header = String(request.headers.get('authorization') || '')
  const expected = \`Bearer \${secret}\`

  if (!secret || header.length !== expected.length) return false

  return timingSafeEqual(
    Buffer.from(header),
    Buffer.from(expected),
  )
}
`;
    content = replaceOnceText(content, marker, `${helper}${marker}`, "cron auth helper");
  }
  if (!content.includes("if (isCronRequest(request)) return POST(request)")) {
    content = content.replace(
      `export async function GET(request: NextRequest) {
  try {`,
      `export async function GET(request: NextRequest) {
  try {
    if (isCronRequest(request)) return POST(request)`,
    );
  }
  content = content.replace(
    "if (!can(admin, 'bugs')) return fail('Sem permissão para scanner.', 403)",
    "if (!can(admin, 'audit.view')) return fail('Sem permissão para visualizar o scanner.', 403)",
  );

  if (!content.includes("const cronRequest = isCronRequest(request)")) {
    content = replaceOnceText(
      content,
      `  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) return fail('Acesso negado.', 403)
    if (!can(admin, 'scanner')) return fail('Sem permissão para rodar scanner.', 403)

    const { data: run } = await supabaseAdmin`,
      `  try {
    const cronRequest = isCronRequest(request)
    const admin = cronRequest ? null : await getCurrentAdmin(request)

    if (!cronRequest && !admin) return fail('Acesso negado.', 403)
    if (!cronRequest && admin && !can(admin, 'system.scan')) {
      return fail('Sem permissão para rodar scanner.', 403)
    }

    const actorEmail = cronRequest
      ? 'cron@orcaly.system'
      : admin?.email || 'system@orcaly.local'

    const { data: run } = await supabaseAdmin`,
      "scanner cron auth",
    );
  }
  content = content.replace("        created_by: admin.email,", "        created_by: actorEmail,");
  content = content.replace(
    "    await auditLog(admin.email, 'scanner.run_detailed',",
    "    await auditLog(actorEmail, 'scanner.run_detailed',",
  );
  return content;
});

// 13.1) Administração de equipe com corpo limitado e rate limit.
patch("app/api/admin/team/route.ts", (content) => {
  content = addImportAfter(
    content,
    "import { NextRequest, NextResponse } from 'next/server'\n",
    "import { enforceRateLimit } from '@/lib/security/rate-limit'",
    "admin team rate import",
  );
  content = addImportAfter(
    content,
    "import { enforceRateLimit } from '@/lib/security/rate-limit'\n",
    "import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'",
    "admin team body import",
  );

  if (!content.includes("scope: 'admin-team-write'")) {
    content = replaceOnceText(
      content,
      `  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  try {
    const body = await request
      .json()
      .catch(() => ({}))`,
      `  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  try {
    const blocked = await enforceRateLimit(request, {
      scope: 'admin-team-write',
      identity: session.admin.id,
      limit: 30,
      windowSeconds: 60,
    })
    if (blocked) return blocked

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      32 * 1024,
    )`,
      "admin team bounded body",
    );
  }

  if (!content.includes("const bodyError = requestBodyErrorResponse(error)")) {
    content = content.replace(
      `  } catch (error) {
    return NextResponse.json(`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(`,
    );
  }
  return content;
});


// 13.2) Admin de afiliados e troca de senha com limites e metadata preservada.
patch("app/api/admin/affiliates/route.ts", (content) => {
  content = addImportAfter(
    content,
    "import { NextRequest, NextResponse } from 'next/server'\n",
    "import { enforceRateLimit } from '@/lib/security/rate-limit'",
    "admin affiliates rate import",
  );
  content = addImportAfter(
    content,
    "import { enforceRateLimit } from '@/lib/security/rate-limit'\n",
    "import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'",
    "admin affiliates body import",
  );

  content = content.replace(
    `export async function POST(request: NextRequest) {
  try {
    const body = await request
      .json()
      .catch(() => ({}))`,
    `export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceRateLimit(request, {
      scope: 'admin-affiliate-actions',
      limit: 60,
      windowSeconds: 60,
    })
    if (blocked) return blocked

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      32 * 1024,
    )`,
  );

  if (!content.includes("const bodyError = requestBodyErrorResponse(error)")) {
    content = content.replace(
      `  } catch (error) {
    return NextResponse.json(`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(`,
    );
  }
  return content;
});

patch("app/api/admin/change-password/route.ts", (content) => {
  content = addImportAfter(
    content,
    "import { NextRequest, NextResponse } from 'next/server'\n",
    "import { enforceRateLimit } from '@/lib/security/rate-limit'",
    "admin password rate import",
  );
  content = addImportAfter(
    content,
    "import { enforceRateLimit } from '@/lib/security/rate-limit'\n",
    "import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'",
    "admin password body import",
  );

  content = content.replace(
    `  try {
    const body = await request
      .json()
      .catch(() => ({}))
    const password = text(body.password)`,
    `  try {
    const blocked = await enforceRateLimit(request, {
      scope: 'admin-password-change',
      identity: session.admin.id,
      limit: 10,
      windowSeconds: 3600,
    })
    if (blocked) return blocked

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      8 * 1024,
    )
    const password = text(body.password)`,
  );

  if (!content.includes("const existingAuthUser =")) {
    content = replaceOnceText(
      content,
      `    const { error } =
      await session.supabaseAdmin.auth.admin.updateUserById(
        session.admin.user_id,
        {
          password,
          user_metadata: {
            must_change_password: false,
          },
        },
      )

    if (error) throw error`,
      `    const existingAuthUser =
      await session.supabaseAdmin.auth.admin.getUserById(
        session.admin.user_id,
      )

    if (
      existingAuthUser.error ||
      !existingAuthUser.data.user?.id
    ) {
      throw (
        existingAuthUser.error ||
        new Error('Conta administrativa não encontrada.')
      )
    }

    const { error } =
      await session.supabaseAdmin.auth.admin.updateUserById(
        session.admin.user_id,
        {
          password,
          user_metadata: {
            ...(existingAuthUser.data.user.user_metadata || {}),
            must_change_password: false,
          },
        },
      )

    if (error) throw error`,
      "admin password metadata merge",
    );
  }

  if (!content.includes("const bodyError = requestBodyErrorResponse(error)")) {
    content = content.replace(
      `  } catch (error) {
    return NextResponse.json(`,
      `  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(`,
    );
  }
  return content;
});


// 14) Health check coerente com dois backends de IA + Storage real
patch("app/api/system/health/route.ts", (content) => {
  if (!content.includes("const { data: storageBuckets")) {
    content = replaceOnceText(
      content,
      `    const companyId = access.company.id

    const [`,
      `    const companyId = access.company.id

    const { data: storageBuckets, error: storageError } =
      await supabaseAdmin.storage.listBuckets()
    const storageNames = new Set(
      (storageBuckets || []).map((bucket) => bucket.name),
    )
    const requiredStorageBuckets = [
      'site-assets',
      'produtos',
      'financeiro',
      'artes',
    ]
    const missingStorageBuckets = requiredStorageBuckets.filter(
      (bucket) => !storageNames.has(bucket),
    )

    const [`,
      "health storage check",
    );
  }

  content = replaceOnceText(
    content,
    `      {
        key: 'storage',
        title: 'Storage de imagens',
        ok: true,
        description: 'Bucket site-assets deve existir no Supabase.',
      },`,
    `      {
        key: 'storage',
        title: 'Supabase Storage',
        ok: !storageError && missingStorageBuckets.length === 0,
        description: storageError
          ? 'Não foi possível consultar os buckets.'
          : missingStorageBuckets.length
            ? \`Buckets ausentes: \${missingStorageBuckets.join(', ')}.\`
            : 'Buckets essenciais disponíveis.',
      },`,
    "health storage truthful",
  );

  content = replaceOnceText(
    content,
    `      {
        key: 'openai',
        title: 'OpenAI / IA',
        ok: Boolean(process.env.OPENAI_API_KEY),
        description: 'Chave usada pelo assistente IA.',
      },`,
    `      {
        key: 'openai_direct',
        title: 'IA interna / OpenAI',
        ok: Boolean(process.env.OPENAI_API_KEY),
        description: 'Credencial do assistente interno configurada.',
      },
      {
        key: 'ai_gateway',
        title: 'IA pública / Vercel AI Gateway',
        ok: Boolean(
          process.env.AI_GATEWAY_API_KEY ||
          process.env.VERCEL_OIDC_TOKEN
        ),
        description: 'Credencial ou identidade do AI Gateway disponível.',
      },
      {
        key: 'cron',
        title: 'Cron administrativo',
        ok: Boolean(process.env.CRON_SECRET),
        description: 'CRON_SECRET protege a execução automática do scanner.',
      },`,
    "health AI and cron",
  );
  return content;
});


// 14.1) Configuração declarada sem qualquer segredo real.
patch(".env.example", (content) => {
  const additions = `
# IA
OPENAI_API_KEY=
ORCALY_AI_MODEL=
AI_GATEWAY_API_KEY=

# Vercel Cron
CRON_SECRET=

# Asaas - repasses e legado controlado por flags
ASAAS_ENV=sandbox
ASAAS_API_BASE_URL=
ASAAS_MASTER_API_KEY=
ASAAS_ROOT_WALLET_ID=
ASAAS_WEBHOOK_AUTH_TOKEN=
ASAAS_PRODUCTION_APPROVED=false
ASAAS_ENABLED=false
ASAAS_SUBACCOUNTS_ENABLED=false
ASAAS_MARKETPLACE_ENABLED=false
ASAAS_SUBSCRIPTIONS_ENABLED=false
ASAAS_CARD_TOKENIZATION_ENABLED=false
PAYMENT_CHECKOUT_V2_ENABLED=false
PAYMENT_PROVIDER_DEFAULT=mercado_pago
ORCALY_FORCE_NEW_PAYMENTS=false
`;

  if (!content.includes("CRON_SECRET=")) {
    content = `${content.trimEnd()}\n${additions}`;
  }
  return `${content.trimEnd()}\n`;
});

// 15) Gitignore limpo
createOrReplace(".gitignore", `# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem
*.tsbuildinfo
next-env.d.ts

# debug and local reports
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
*.log
/qa-orcaly-*/
/qa-*.txt
/auditoria-*.txt
/resultado-*.txt
/resultado-*.json

# environment and deployment
.env*
!.env.example
.vercel/

# local backups and one-off repair artifacts
/.orcaly-*/
/orcaly-payment-flows-phase1/
/orcaly-payment-flows-phase1.zip
/*.ps1

# local hardening output
/.orcaly-hardening-local/
/hardening-report-*.json
/hardening-report-*.txt
`);

// 16) Security checker permanente e abrangente.

// 19.8) Idempotência recorrente de assinatura e estorno seguro de acesso.
patch("lib/subscription-service.ts", (content) => {
  content = replaceOnceText(
    content,
    `export async function mercadoPagoPlatformRequest(
  path: string,
  options: RequestInit = {},
) {
  return subscriptionMercadoPagoRequest(path, options);
}`,
    `export async function mercadoPagoPlatformRequest(
  path: string,
  options: RequestInit = {},
  idempotencyKey?: string,
) {
  return subscriptionMercadoPagoRequest(
    path,
    options,
    idempotencyKey,
  );
}`,
    "subscription platform request idempotency passthrough",
  );

  if (!content.includes("export async function reconcileReversedSubscriptionPayment")) {
    const anchor = `export function parseOrcalySubscriptionReference(value: unknown) {`;
    const helper = `export async function reconcileReversedSubscriptionPayment(
  admin: ReturnType<typeof getSupabaseAdmin>,
  company: any,
  providerReference: string,
  providerStatus: string,
) {
  const companyId = String(company?.id || "").trim();
  const reference = String(providerReference || "").trim();
  const remoteStatus = String(providerStatus || "reversed")
    .trim()
    .toLowerCase();

  if (!companyId || !reference) {
    return { rolledBack: false, reason: "missing_reference" };
  }

  const { data: approvalEvent, error: eventError } = await admin
    .from("subscription_events")
    .select("metadata,created_at")
    .eq("company_id", companyId)
    .eq("event_type", "payment_approved")
    .eq("provider_reference", reference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventError) throw eventError;

  const metadata =
    approvalEvent?.metadata &&
    typeof approvalEvent.metadata === "object" &&
    !Array.isArray(approvalEvent.metadata)
      ? (approvalEvent.metadata as Record<string, unknown>)
      : {};
  const grantedUntil = validDate(metadata.access_until);
  const previousUntil = validDate(metadata.previous_access_until);

  const { data: freshCompany, error: companyError } = await admin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) throw companyError;
  if (!freshCompany?.id) {
    return { rolledBack: false, reason: "company_not_found" };
  }

  const currentUntil = maxDate(
    freshCompany.access_until,
    freshCompany.assinatura_expira_em,
  );
  const sameGrant = Boolean(
    grantedUntil &&
      currentUntil &&
      Math.abs(currentUntil.getTime() - grantedUntil.getTime()) <= 5000,
  );
  let rolledBack = false;
  let newStatus = freshCompany.assinatura_status || null;
  let rollbackUntil: Date | null = currentUntil;

  if (sameGrant) {
    const now = new Date();
    rollbackUntil = previousUntil && previousUntil > now
      ? previousUntil
      : now;
    newStatus = "past_due";

    const { error: rollbackError } = await admin
      .from("companies")
      .update({
        assinatura_status: newStatus,
        assinatura_expira_em: rollbackUntil.toISOString(),
        access_until: rollbackUntil.toISOString(),
        assinatura_pix_avulso_status:
          String(freshCompany.assinatura_forma_pagamento_preferida || "")
            .toLowerCase()
            .includes("pix")
            ? remoteStatus
            : freshCompany.assinatura_pix_avulso_status || null,
        updated_at: now.toISOString(),
      })
      .eq("id", companyId);

    if (rollbackError) throw rollbackError;
    rolledBack = true;
  }

  await recordSubscriptionEvent(admin, {
    companyId,
    eventType: "payment_reversed",
    oldStatus: freshCompany.assinatura_status || null,
    newStatus,
    providerReference: reference + ":" + remoteStatus,
    metadata: {
      original_provider_reference: reference,
      provider_status: remoteStatus,
      rolled_back: rolledBack,
      granted_access_until: grantedUntil?.toISOString() || null,
      previous_access_until: previousUntil?.toISOString() || null,
      current_access_until: currentUntil?.toISOString() || null,
      resulting_access_until: rollbackUntil?.toISOString() || null,
    },
  });

  return {
    rolledBack,
    accessUntil: rollbackUntil?.toISOString() || null,
  };
}

`;
    content = replaceOnceText(
      content,
      anchor,
      `${helper}${anchor}`,
      "subscription reversal helper",
    );
  }

  content = content.replace(
    `      amount: options.amount || null,
      access_until: newAccessUntil.toISOString(),`,
    `      amount: options.amount || null,
      previous_access_until: currentEnd?.toISOString() || null,
      access_until: newAccessUntil.toISOString(),`,
  );

  return content;
});

patch("lib/subscription-mercado-pago-transparent.ts", (content) => {
  if (!content.includes("existingPaymentRow")) {
    content = replaceOnceRegex(
      content,
      /  const \{ data: paymentRow, error: paymentError \} =[\s\S]*?  const externalReference = buildSubscriptionReference\(\{\n    kind: "recurring",\n    companyId,\n    plan: planKey,\n    paymentRowId: String\(paymentRow\.id\),\n  \}\);/,
      `  const { data: existingPaymentRow, error: existingPaymentError } =
    await context.admin
      .from("plan_payments")
      .select("*")
      .eq("company_id", companyId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

  if (existingPaymentError) throw existingPaymentError;

  let paymentRow = existingPaymentRow as JsonRecord | null;

  if (
    paymentRow &&
    normalizePlanKey(paymentRow.plano) !== planKey
  ) {
    throw Object.assign(
      new Error("A chave de idempotência já foi usada em outro plano."),
      { status: 409 },
    );
  }

  if (!paymentRow) {
    const inserted = await context.admin
      .from("plan_payments")
      .insert({
        company_id: companyId,
        plano: planKey,
        valor: plan.price,
        status: "created",
        tipo: "subscription",
        payment_method: "card_recurring",
        provider: "mercado_pago",
        idempotency_key: idempotencyKey,
        email: payerEmail,
        nome_empresa: text(company.nome) || "Empresa",
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data?.id) {
      throw Object.assign(
        new Error(
          inserted.error?.message ||
            "Nao foi possivel preparar a assinatura.",
        ),
        { status: 500 },
      );
    }

    paymentRow = inserted.data as JsonRecord;
  }

  const externalReference =
    text(paymentRow.external_reference) ||
    buildSubscriptionReference({
      kind: "recurring",
      companyId,
      plan: planKey,
      paymentRowId: String(paymentRow.id),
    });

  if (!text(paymentRow.external_reference)) {
    const { error: referenceError } = await context.admin
      .from("plan_payments")
      .update({
        external_reference: externalReference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id)
      .eq("company_id", companyId);

    if (referenceError) throw referenceError;
    paymentRow.external_reference = externalReference;
  }`,
      "transparent subscription idempotent row reuse",
    );
  }

  content = replaceOnceRegex(
    content,
    /  let subscription: JsonRecord;\n\n  try \{[\s\S]*?\n  \}\n\n  const subscriptionId = text\(subscription\.id\);/,
    `  let subscription: JsonRecord;
  const existingSubscriptionId = text(
    paymentRow.provider_subscription_id ||
      paymentRow.mercado_pago_preapproval_id,
  );

  if (existingSubscriptionId) {
    subscription = (await mercadoPagoPlatformRequest(
      \`/preapproval/\${encodeURIComponent(existingSubscriptionId)}\`,
    )) as JsonRecord;
  } else {
    try {
      subscription =
        (await mercadoPagoPlatformRequest(
          "/preapproval",
          {
            method: "POST",
            body: JSON.stringify({
              reason: \`Plano \${plan.name} - Orcaly\`,
              external_reference: externalReference,
              payer_email: payerEmail,
              card_token_id: cardTokenId,
              auto_recurring: autoRecurring,
              back_url: \`\${getAppUrl()}/painel/assinatura\`,
              status: "authorized",
            }),
          },
          idempotencyKey,
        )) as JsonRecord;
    } catch (error) {
      const providerStatus =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status?: number }).status || 0)
          : 0;

      await context.admin
        .from("plan_payments")
        .update({
          status:
            providerStatus >= 400 && providerStatus < 500
              ? "failed"
              : "creating",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRow.id)
        .eq("company_id", companyId);

      throw error;
    }
  }

  const subscriptionId = text(subscription.id);`,
    "transparent subscription provider idempotency",
  );

  return content;
});


patch("lib/subscription-mercado-pago-transparent.ts", (content) => {
  if (!content.includes("sameIdempotentSubscription")) {
    content = replaceOnceText(
      content,
      `  if (
    currentSubscriptionId &&
    ["authorized", "pending", "paused"].includes(
      currentProviderStatus,
    ) &&
    !Boolean(company.cancel_at_period_end)
  ) {
    throw Object.assign(
      new Error(
        "Esta empresa ja possui uma assinatura recorrente.",
      ),
      { status: 409 },
    );
  }`,
      `  const { data: currentIdempotentRow, error: currentIdempotentError } =
    await context.admin
      .from("plan_payments")
      .select("provider_subscription_id,mercado_pago_preapproval_id")
      .eq("company_id", companyId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

  if (currentIdempotentError) throw currentIdempotentError;

  const idempotentSubscriptionId = text(
    currentIdempotentRow?.provider_subscription_id ||
      currentIdempotentRow?.mercado_pago_preapproval_id,
  );
  const sameIdempotentSubscription = Boolean(
    currentSubscriptionId &&
      idempotentSubscriptionId &&
      currentSubscriptionId === idempotentSubscriptionId,
  );

  if (
    currentSubscriptionId &&
    ["authorized", "pending", "paused"].includes(
      currentProviderStatus,
    ) &&
    !Boolean(company.cancel_at_period_end) &&
    !sameIdempotentSubscription
  ) {
    throw Object.assign(
      new Error(
        "Esta empresa ja possui uma assinatura recorrente.",
      ),
      { status: 409 },
    );
  }`,
      "transparent subscription same idempotent retry",
    );
  }
  return content;
});

patch("components/subscription/MercadoPagoSubscriptionCheckout.tsx", (content) => {
  if (!content.includes('recurringIdempotencyRef.current = "";\n          setPaymentStatus("paid");')) {
    content = replaceOnceText(
      content,
      `          setPaymentStatus("paid");
          setMessage("Renovação automática ativada.");`,
      `          recurringIdempotencyRef.current = "";
          setPaymentStatus("paid");
          setMessage("Renovação automática ativada.");`,
      "recurring checkout clear idempotency on success",
    );
  }
  return content;
});

patch("lib/subscription-checkout-payment.ts", (content) => {
  content = addImportAfter(
    content,
    '  applyApprovedSubscriptionPayment,\n',
    '  reconcileReversedSubscriptionPayment,',
    "subscription one-time reversal import",
  );

  if (!content.includes("await reconcileReversedSubscriptionPayment(\n        admin,\n        company,")) {
    content = replaceOnceText(
      content,
      `      await reverseAffiliateCommissionForPayment(
        admin,
        paymentId,
        \`Pagamento \${remoteStatus} no Mercado Pago.\`,
      ).catch((affiliateError) => {
        console.error(
          "orcaly_affiliate_reversal_error",
          affiliateError instanceof Error
            ? affiliateError.message
            : affiliateError,
        );
      });`,
      `      await reverseAffiliateCommissionForPayment(
        admin,
        paymentId,
        \`Pagamento \${remoteStatus} no Mercado Pago.\`,
      ).catch((affiliateError) => {
        console.error(
          "orcaly_affiliate_reversal_error",
          affiliateError instanceof Error
            ? affiliateError.message
            : affiliateError,
        );
      });

      await reconcileReversedSubscriptionPayment(
        admin,
        company,
        paymentId,
        remoteStatus,
      );`,
      "subscription one-time access reversal",
    );
  }
  return content;
});

patch("app/api/mercado-pago/webhook/route.ts", (content) => {
  content = addImportAfter(
    content,
    '  recordSubscriptionEvent,\n',
    '  reconcileReversedSubscriptionPayment,',
    "subscription webhook reversal import",
  );

  content = content.replace(
    `      await reverseAffiliateCommissionForPayment(
        admin,
        providerReference,
        \`Pagamento recorrente \${paymentStatus}.\`,
      );`,
    `      await reverseAffiliateCommissionForPayment(
        admin,
        providerReference,
        \`Pagamento recorrente \${paymentStatus}.\`,
      );
      await reconcileReversedSubscriptionPayment(
        admin,
        found.company,
        providerReference,
        paymentStatus,
      );`,
  );

  content = content.replace(
    `      await reverseAffiliateCommissionForPayment(
        admin,
        providerReference,
        \`Pagamento Pix \${status}.\`,
      );`,
    `      await reverseAffiliateCommissionForPayment(
        admin,
        providerReference,
        \`Pagamento Pix \${status}.\`,
      );
      await reconcileReversedSubscriptionPayment(
        admin,
        found.company,
        providerReference,
        status,
      );`,
  );

  return content;
});


// 19.9) Aplicação de pagamento aprovada exatamente uma vez, mesmo com webhooks repetidos.
patch("lib/subscription-service.ts", (content) => {
  content = replaceOnceRegex(
    content,
    /export async function applyApprovedSubscriptionPayment\([\s\S]*\n\}\s*$/,
    `export async function applyApprovedSubscriptionPayment(
  admin: ReturnType<typeof getSupabaseAdmin>,
  company: any,
  options: {
    plan?: unknown;
    providerReference: string;
    preapprovalId?: string | null;
    nextPaymentDate?: string | null;
    paymentType: "pix" | "card" | "card_recurring";
    amount?: number | null;
  },
) {
  const now = new Date();
  const planKey = normalizePlan(
    options.plan || company.assinatura_plano || company.plano,
  );
  const currentEnd = maxDate(
    company.access_until,
    company.assinatura_expira_em,
  );
  const providerNext = validDate(options.nextPaymentDate);
  const newAccessUntil =
    providerNext && providerNext > now
      ? providerNext
      : addMonth(currentEnd && currentEnd > now ? currentEnd : now);
  const providerReference = String(options.providerReference || "").trim();

  if (!providerReference) {
    throw new Error("Referência do pagamento aprovada ausente.");
  }

  const { data: applied, error: applyError } = await admin.rpc(
    "orcaly_apply_subscription_payment_once",
    {
      p_company_id: company.id,
      p_provider_reference: providerReference,
      p_plan: planKey,
      p_payment_type: options.paymentType,
      p_amount: options.amount || null,
      p_previous_status: company.assinatura_status || null,
      p_previous_access_until: currentEnd?.toISOString() || null,
      p_new_access_until: newAccessUntil.toISOString(),
      p_preapproval_id: options.preapprovalId || null,
      p_next_payment_date: options.nextPaymentDate || null,
    },
  );

  if (applyError) throw applyError;

  const { data: updatedCompany, error: companyError } = await admin
    .from("companies")
    .select("*")
    .eq("id", company.id)
    .single();

  if (companyError || !updatedCompany?.id) {
    throw companyError || new Error("Empresa não encontrada após pagamento.");
  }

  try {
    await createAffiliateCommissionForApprovedPayment(
      admin,
      updatedCompany,
      {
        providerPaymentId: providerReference,
        plan: planKey,
        amount: options.amount || null,
        paidAt: now.toISOString(),
      },
    );
  } catch (affiliateError) {
    console.error(
      "orcaly_affiliate_commission_error",
      affiliateError instanceof Error
        ? affiliateError.message
        : affiliateError,
    );
  }

  if (applied !== true) {
    return updatedCompany;
  }

  return updatedCompany;
}`,
    "subscription payment apply exactly once",
  );
  return content;
});

createOrReplace("scripts/security-check.mjs", `import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const warnings = []

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function requireText(file, text, label) {
  if (!read(file).includes(text)) failures.push(\`\${label}: \${file}\`)
}

function forbidText(file, text, label) {
  if (read(file).includes(text)) failures.push(\`\${label}: \${file}\`)
}

requireText('lib/orcaly-security.ts', 'Content-Security-Policy', 'CSP obrigatoria ausente')
forbidText('lib/orcaly-security.ts', 'Content-Security-Policy-Report-Only', 'CSP ainda esta apenas em report-only')
requireText(
  'lib/mercado-pago.ts',
  'if (!secret || !xSignature || !xRequestId || !dataId) return false',
  'Webhook ainda permite segredo ausente',
)
forbidText('lib/admin-auth.ts', 'araujovinicius249@gmail.com', 'Super admin fixo no codigo')
forbidText('lib/company-access.ts', 'araujovinicius249@gmail.com', 'Super admin fixo no acesso da empresa')
forbidText('lib/company-access.ts', ".from('admin_users')", 'admin_users ainda atua como autoridade administrativa')
forbidText('lib/company-access.ts', 'shouldAttachOwner', 'Vinculo automatico por e-mail ainda ativo')
forbidText('proxy.ts', 'viniciusadm@orcaly.com', 'Owner da plataforma ainda esta fixo por e-mail no proxy')
forbidText('app/api/public-site/[slug]/route.ts', ".select('*')", 'API publica ainda seleciona todos os campos')
requireText('lib/affiliates/workspace.ts', 'isValidCourseLesson', 'Academia sem validacao server-side')
forbidText('lib/affiliates/workspace.ts', 'totalScore = cleanNumber(body.totalScore', 'Treinamento ainda confia em nota do cliente')
forbidText('lib/panel-storage.ts', 'image/svg+xml', 'Logo ainda aceita SVG nao sanitizado')
forbidText('app/api/public/home-chat/route.ts', 'failOpen: true', 'Chat pago ainda abre o rate limit em falha')
requireText('app/api/admin/scan/route.ts', 'CRON_SECRET', 'Scanner cron sem segredo')
requireText('app/api/company/current/route.ts', 'getCompanySubscriptionAccess', 'Acesso da empresa sem regra canonica de assinatura')
forbidText(
  'app/api/marketplace/payments/webhook/mercado-pago/route.ts',
  'Notificacao legada sem assinatura',
  'Webhook marketplace ainda aceita notificacao sem assinatura',
)
requireText(
  'app/api/marketplace/payments/webhook/mercado-pago/route.ts',
  'cleanSensitivePayload',
  'Webhook marketplace ainda persiste payload financeiro sem sanitizacao',
)
requireText(
  'app/api/leads/complete-account/route.ts',
  'verifySignupCheckoutToken',
  'Finalizacao de conta sem token HMAC do checkout',
)
requireText(
  'lib/subscription-checkout-payment.ts',
  'Chave de idempotência do pagamento inválida.',
  'Checkout avulso de assinatura sem idempotencia obrigatoria',
)
requireText(
  'lib/subscription-mercado-pago-transparent.ts',
  'Chave de idempotência da assinatura inválida.',
  'Assinatura recorrente sem idempotencia obrigatoria',
)
requireText(
  'lib/subscription-mercado-pago-transparent.ts',
  'existingPaymentRow',
  'Assinatura recorrente sem reutilizacao da linha idempotente',
)
requireText(
  'components/subscription/MercadoPagoSubscriptionCheckout.tsx',
  'recurringIdempotencyRef.current = "";',
  'Cliente recorrente nao limpa chave idempotente apos sucesso',
)
requireText(
  'lib/subscription-service.ts',
  'reconcileReversedSubscriptionPayment',
  'Estorno de assinatura nao reconcilia acesso concedido',
)
requireText(
  'lib/subscription-service.ts',
  'previous_access_until',
  'Pagamento aprovado nao registra acesso anterior para rollback seguro',
)
requireText(
  'lib/subscription-service.ts',
  'orcaly_apply_subscription_payment_once',
  'Pagamento aprovado ainda pode ser aplicado mais de uma vez',
)
requireText(
  'lib/subscription-checkout-payment.ts',
  'reconcileReversedSubscriptionPayment',
  'Checkout avulso nao reverte acesso em estorno',
)
requireText(
  'lib/affiliates/server.ts',
  'Pagamento já está sendo processado ou não foi aprovado.',
  'Payout sem claim atomico antes da transferencia',
)
requireText(
  'lib/affiliates/server.ts',
  'return "basico";',
  'Plano desconhecido de afiliado ainda pode cair em plano intermediario',
)
requireText(
  'lib/affiliates/server.ts',
  'settings.payouts_enabled',
  'Solicitacao de payout nao respeita flag global de pagamentos',
)
requireText(
  'lib/affiliates/server.ts',
  'Resultado incerto no provedor. Não reenviar automaticamente',
  'Payout ainda pode ser reenviado apos resultado incerto',
)
forbidText(
  'lib/company-access.ts',
  ".eq('slug', 'grafica-flash')",
  'Fallback de tenant fixo para admin da plataforma ainda existe',
)
requireText(
  'app/api/company/current/route.ts',
  'sanitizeCompanyForClient',
  'API company/current ainda devolve linha administrativa sem sanitizacao',
)
requireText(
  'app/api/crm/leads/route.ts',
  "companyPlanAllows(companyAccess.company, 'profissional')",
  'CRM sem gate de plano server-side',
)

const sourceExtensions = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.sql', '.css', '.md', '.json',
])

const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\\0')
  .filter(Boolean)

const mojibakeMarkers = [
  'Ã§', 'Ã£', 'Ãµ', 'Ã©', 'Ãª', 'Ã¡', 'Ãí', 'Ã­', 'Ãó', 'Ã³',
  'Ãú', 'Ãº', 'Â·', 'Âº', 'Âª', 'âœ“', 'â†’', 'â€œ', 'â€',
]

for (const file of tracked) {
  const extension = path.extname(file).toLowerCase()
  if (!sourceExtensions.has(extension)) continue

  let content = ''
  try {
    content = read(file)
  } catch {
    continue
  }

  const firstChunk = content.slice(0, 300)
  const isClient = /['"]use client['"]/.test(firstChunk)

  if (isClient && content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    failures.push(\`Service role referenciada em arquivo client: \${file}\`)
  }

  for (const marker of mojibakeMarkers) {
    if (content.includes(marker)) {
      failures.push(\`Mojibake "\${marker}" encontrado: \${file}\`)
      break
    }
  }

  if (/\\beval\\s*\\(/.test(content) || /new\\s+Function\\s*\\(/.test(content)) {
    failures.push(\`Execucao dinamica perigosa encontrada: \${file}\`)
  }

  if (
    /APP_USR-[A-Za-z0-9_-]{20,}/.test(content) ||
    /sk_(?:live|test)_[A-Za-z0-9]{20,}/.test(content)
  ) {
    failures.push(\`Segredo com formato conhecido encontrado no codigo: \${file}\`)
  }

  if (file.startsWith('app/api/') && /request\\.json\\s*\\(/.test(content) && !content.includes('readJsonBody')) {
    warnings.push(\`Rota usa request.json() sem helper de byte-limit: \${file}\`)
  }

  if (
    file.startsWith('app/api/') &&
    /request\\.text\\s*\\(/.test(content) &&
    !content.includes('readTextBody') &&
    !content.includes('Buffer.byteLength')
  ) {
    warnings.push(\`Rota usa request.text() sem byte-limit compartilhado: \${file}\`)
  }

  if (/dangerouslySetInnerHTML/.test(content)) {
    warnings.push(\`Revisar dangerouslySetInnerHTML: \${file}\`)
  }

  if (/\\.or\\s*\\(\\s*\`/.test(content) && content.includes('\${')) {
    warnings.push(\`Revisar filtro PostgREST .or() interpolado: \${file}\`)
  }
}

const migrationDir = path.join(root, 'supabase', 'migrations')
const partnerAuthorityMigration = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).find((name) =>
      name.endsWith('_affiliate_workspace_server_authority.sql'),
    )
  : null

if (!partnerAuthorityMigration) {
  failures.push('Migration affiliate_workspace_server_authority ausente')
} else {
  const migration = read(path.join('supabase', 'migrations', partnerAuthorityMigration))
  if (!migration.includes('revoke insert, update, delete')) {
    failures.push('Migration de parceiros nao revoga escrita direta')
  }
  if (!migration.includes('affiliate_activity_events_source_key_uq')) {
    failures.push('Indice de idempotencia de XP ausente')
  }
  if (!migration.includes('plan_payments_company_idempotency_uq')) {
    failures.push('Indice de idempotencia de cobranca de assinatura ausente')
  }
  if (!migration.includes('orcaly_apply_subscription_payment_once')) {
    failures.push('Ledger idempotente de aplicacao de assinatura ausente')
  }
  if (!migration.includes('orcaly_company_has_plan_access')) {
    failures.push('Funcao canonica de plano/assinatura no banco ausente')
  }
  if (!migration.includes('orcaly_current_user_can')) {
    failures.push('Funcao canonica de capacidade por cargo no banco ausente')
  }
  if (!migration.includes('as restrictive')) {
    failures.push('Policies restritivas de plano/cargo ausentes')
  }
  if (!migration.includes("'crm_leads'")) {
    failures.push('CRM ainda nao foi tornado server-authoritative')
  }
  if (!migration.includes("('products', 'essencial', 'products')")) {
    failures.push('Products ainda nao esta protegido por plano/cargo no banco')
  }
  if (!migration.includes("('orders', 'essencial', 'orders')")) {
    failures.push('Orders ainda nao esta protegido por plano/cargo no banco')
  }
  if (!migration.includes('orcaly_order_items_capability')) {
    failures.push('Order items ainda nao herda autorizacao do pedido')
  }
  if (!migration.includes('orcaly_company_update_capability')) {
    failures.push('Atualizacao direta de companies sem gate de configuracao')
  }
}

console.log(\`SECURITY_SCAN_TRACKED_FILES=\${tracked.length}\`)
console.log(\`SECURITY_SCAN_WARNINGS=\${warnings.length}\`)
for (const warning of warnings) console.warn(\`[WARN] \${warning}\`)

if (failures.length) {
  console.error('\\nFALHAS DE SEGURANCA ENCONTRADAS:')
  for (const failure of failures) console.error(\`- \${failure}\`)
  process.exit(1)
}

console.log('SECURITY_CHECK_EXIT_CODE=0')
`);

// SQL será copiado para migration criada pelo Supabase CLI no PowerShell.
createOrReplace(".orcaly-hardening-local/affiliate_workspace_server_authority.sql", `-- ORCALY_AFFILIATE_WORKSPACE_SERVER_AUTHORITY_V1
begin;

-- O parceiro consulta os próprios dados, mas mutações passam pelo backend.
revoke insert, update, delete on public.affiliate_leads from authenticated;
revoke insert, update, delete on public.affiliate_tasks from authenticated;
revoke insert, update, delete on public.affiliate_goals from authenticated;
revoke insert, update, delete on public.affiliate_activity_events from authenticated;
revoke insert, update, delete on public.affiliate_course_progress from authenticated;
revoke insert, update, delete on public.affiliate_certifications from authenticated;
revoke insert, update, delete on public.affiliate_training_sessions from authenticated;
revoke insert, update, delete on public.affiliate_achievements from authenticated;

drop policy if exists affiliate_leads_insert_own on public.affiliate_leads;
drop policy if exists affiliate_leads_update_own on public.affiliate_leads;
drop policy if exists affiliate_leads_delete_own on public.affiliate_leads;

drop policy if exists affiliate_tasks_insert_own on public.affiliate_tasks;
drop policy if exists affiliate_tasks_update_own on public.affiliate_tasks;
drop policy if exists affiliate_tasks_delete_own on public.affiliate_tasks;

drop policy if exists affiliate_goals_insert_own on public.affiliate_goals;
drop policy if exists affiliate_goals_update_own on public.affiliate_goals;
drop policy if exists affiliate_goals_delete_own on public.affiliate_goals;

drop policy if exists affiliate_events_insert_own on public.affiliate_activity_events;
drop policy if exists affiliate_events_update_own on public.affiliate_activity_events;
drop policy if exists affiliate_events_delete_own on public.affiliate_activity_events;

drop policy if exists affiliate_course_insert_own on public.affiliate_course_progress;
drop policy if exists affiliate_course_update_own on public.affiliate_course_progress;
drop policy if exists affiliate_course_delete_own on public.affiliate_course_progress;

drop policy if exists affiliate_cert_insert_own on public.affiliate_certifications;
drop policy if exists affiliate_cert_update_own on public.affiliate_certifications;
drop policy if exists affiliate_cert_delete_own on public.affiliate_certifications;

drop policy if exists affiliate_training_insert_own on public.affiliate_training_sessions;
drop policy if exists affiliate_training_update_own on public.affiliate_training_sessions;
drop policy if exists affiliate_training_delete_own on public.affiliate_training_sessions;

drop policy if exists affiliate_achievements_insert_own on public.affiliate_achievements;
drop policy if exists affiliate_achievements_update_own on public.affiliate_achievements;
drop policy if exists affiliate_achievements_delete_own on public.affiliate_achievements;

-- Evita XP duplicado mesmo sob duas requisições concorrentes.
create unique index if not exists affiliate_activity_events_source_key_uq
  on public.affiliate_activity_events (
    affiliate_id,
    (metadata->>'source_key')
  )
  where metadata ? 'source_key';

-- A mesma tentativa de cobrança avulsa nunca cria duas linhas/charges.
create unique index if not exists plan_payments_company_idempotency_uq
  on public.plan_payments (company_id, idempotency_key)
  where idempotency_key is not null;

-- Ledger privado garante que o mesmo pagamento aprovado só estenda acesso uma vez.
create schema if not exists orcaly_private;
revoke all on schema orcaly_private from public, anon, authenticated;

create table if not exists orcaly_private.subscription_payment_applications (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_reference text not null,
  applied_at timestamptz not null default clock_timestamp(),
  primary key (company_id, provider_reference)
);

revoke all on orcaly_private.subscription_payment_applications
  from public, anon, authenticated;

create or replace function public.orcaly_apply_subscription_payment_once(
  p_company_id uuid,
  p_provider_reference text,
  p_plan text,
  p_payment_type text,
  p_amount numeric,
  p_previous_status text,
  p_previous_access_until timestamptz,
  p_new_access_until timestamptz,
  p_preapproval_id text,
  p_next_payment_date timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_now timestamptz := clock_timestamp();
  v_previous_status text;
  v_previous_access_until timestamptz;
  v_new_access_until timestamptz;
begin
  if p_company_id is null or coalesce(length(trim(p_provider_reference)), 0) < 1 then
    raise exception 'invalid subscription payment application';
  end if;

  select
    c.assinatura_status,
    greatest(
      coalesce(c.access_until, '-infinity'::timestamptz),
      coalesce(c.assinatura_expira_em, '-infinity'::timestamptz)
    )
  into v_previous_status, v_previous_access_until
  from public.companies c
  where c.id = p_company_id
  for update;

  if not found then
    raise exception 'company not found';
  end if;

  if v_previous_access_until = '-infinity'::timestamptz then
    v_previous_access_until := null;
  end if;

  v_new_access_until := case
    when p_next_payment_date is not null and p_next_payment_date > v_now
      then p_next_payment_date
    else greatest(coalesce(v_previous_access_until, v_now), v_now) + interval '1 month'
  end;

  insert into orcaly_private.subscription_payment_applications (
    company_id,
    provider_reference,
    applied_at
  )
  values (
    p_company_id,
    trim(p_provider_reference),
    v_now
  )
  on conflict (company_id, provider_reference) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  update public.companies
  set
    ativo = true,
    plano = p_plan,
    assinatura_plano = p_plan,
    assinatura_status = 'ativa',
    assinatura_inicio = coalesce(assinatura_inicio, v_now),
    assinatura_expira_em = v_new_access_until,
    access_until = v_new_access_until,
    assinatura_ultimo_pagamento = v_now,
    assinatura_proxima_cobranca = p_next_payment_date,
    assinatura_auto_recorrente = (p_payment_type = 'card_recurring'),
    assinatura_forma_pagamento_preferida = case
      when p_payment_type = 'card_recurring' then 'cartao_recorrente'
      when p_payment_type = 'card' then 'cartao_avulso'
      else 'pix_avulso'
    end,
    assinatura_pix_avulso_status = case
      when p_payment_type = 'pix' then 'paid'
      else assinatura_pix_avulso_status
    end,
    assinatura_pix_avulso_ultimo_pagamento = case
      when p_payment_type = 'pix' then v_now
      else assinatura_pix_avulso_ultimo_pagamento
    end,
    mercado_pago_subscription_id = coalesce(
      nullif(p_preapproval_id, ''),
      mercado_pago_subscription_id
    ),
    mercado_pago_subscription_status = case
      when p_payment_type = 'card_recurring' then 'authorized'
      else mercado_pago_subscription_status
    end,
    cancel_at_period_end = false,
    updated_at = v_now
  where id = p_company_id;

  if not found then
    raise exception 'company not found';
  end if;

  insert into public.subscription_events (
    company_id,
    event_type,
    old_status,
    new_status,
    provider,
    provider_reference,
    metadata
  )
  values (
    p_company_id,
    'payment_approved',
    v_previous_status,
    'ativa',
    'mercado_pago',
    trim(p_provider_reference),
    jsonb_build_object(
      'plan', p_plan,
      'payment_type', p_payment_type,
      'amount', p_amount,
      'previous_access_until', v_previous_access_until,
      'access_until', v_new_access_until
    )
  )
  on conflict (company_id, event_type, provider_reference) do nothing;

  return true;
exception
  when others then
    delete from orcaly_private.subscription_payment_applications
    where company_id = p_company_id
      and provider_reference = trim(p_provider_reference);
    raise;
end;
$$;

revoke all on function public.orcaly_apply_subscription_payment_once(
  uuid, text, text, text, numeric, text, timestamptz, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.orcaly_apply_subscription_payment_once(
  uuid, text, text, text, numeric, text, timestamptz, timestamptz, text, timestamptz
) to service_role;

-- Regra única de acesso comercial: assinatura válida + nível de plano.
create or replace function public.orcaly_company_has_plan_access(
  p_company_id uuid,
  p_required_plan text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and coalesce(c.ativo, true) = true
      and greatest(
        coalesce(c.access_until, '-infinity'::timestamptz),
        coalesce(c.assinatura_expira_em, '-infinity'::timestamptz),
        case
          when lower(coalesce(c.assinatura_status, '')) = 'trialing'
            then coalesce(c.trial_ends_at, '-infinity'::timestamptz)
          else '-infinity'::timestamptz
        end
      ) > now()
      and (
        case lower(coalesce(c.assinatura_plano, c.plano, 'essencial'))
          when 'premium' then 3
          when 'profissional' then 2
          when 'intermediario' then 2
          when 'intermediário' then 2
          else 1
        end
      ) >= (
        case lower(coalesce(p_required_plan, 'essencial'))
          when 'premium' then 3
          when 'profissional' then 2
          when 'intermediate' then 2
          when 'intermediario' then 2
          when 'intermediário' then 2
          else 1
        end
      )
  );
$$;

revoke all on function public.orcaly_company_has_plan_access(uuid, text)
  from public, anon;
grant execute on function public.orcaly_company_has_plan_access(uuid, text)
  to authenticated, service_role;

-- Capacidade por cargo. A policy de posse da empresa continua sendo necessária;
-- esta função adiciona o limite funcional (financeiro, CRM, proposta, gestão).
create or replace function public.orcaly_current_user_can(
  p_company_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.companies c
      where c.id = p_company_id
        and (
          c.owner_id = (select auth.uid())
          or c.tester_id = (select auth.uid())
        )
    )
    or exists (
      select 1
      from public.company_members m
      where m.company_id = p_company_id
        and m.user_id = (select auth.uid())
        and lower(coalesce(m.status, '')) = 'ativo'
        and (
          case lower(coalesce(p_capability, ''))
            when 'finance' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin')
            when 'proposal' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'atendente')
            when 'crm' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'atendente')
            when 'manage' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin')
            when 'products' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'producao')
            when 'orders' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'atendente', 'producao')
            when 'production' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'producao')
            when 'config' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'admin')
            else false
          end
        )
    );
$$;

revoke all on function public.orcaly_current_user_can(uuid, text)
  from public, anon;
grant execute on function public.orcaly_current_user_can(uuid, text)
  to authenticated, service_role;

-- Tabelas que continuam acessadas diretamente pelo cliente recebem duas camadas:
-- uma policy permissiva de cargo/empresa e outra RESTRICTIVE de plano/assinatura.
do $$
declare
  item record;
  member_policy text;
  capability_policy text;
  plan_policy text;
begin
  for item in
    select *
    from (
      values
        ('products', 'essencial', 'products'),
        ('orders', 'essencial', 'orders'),
        ('financial_transactions', 'profissional', 'finance'),
        ('financial_material_entries', 'profissional', 'finance'),
        ('marketplace_coupons', 'profissional', 'manage'),
        ('proposals', 'premium', 'proposal'),
        ('proposal_events', 'premium', 'proposal')
    ) as feature_table(table_name, required_plan, capability)
  loop
    if to_regclass(format('public.%I', item.table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', item.table_name);

    member_policy := format('orcaly_feature_member_%s', item.table_name);
    capability_policy := format('orcaly_feature_capability_%s', item.table_name);
    plan_policy := format('orcaly_feature_plan_%s', item.table_name);

    execute format(
      'drop policy if exists %I on public.%I',
      member_policy,
      item.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      capability_policy,
      item.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      plan_policy,
      item.table_name
    );

    execute format(
      'create policy %I on public.%I as permissive for all to authenticated using (public.orcaly_current_user_can(company_id, %L)) with check (public.orcaly_current_user_can(company_id, %L))',
      member_policy,
      item.table_name,
      item.capability,
      item.capability
    );

    -- RESTRICTIVE impede que uma policy permissiva antiga/broad contorne o cargo.
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.orcaly_current_user_can(company_id, %L)) with check (public.orcaly_current_user_can(company_id, %L))',
      capability_policy,
      item.table_name,
      item.capability,
      item.capability
    );

    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.orcaly_company_has_plan_access(company_id, %L)) with check (public.orcaly_company_has_plan_access(company_id, %L))',
      plan_policy,
      item.table_name,
      item.required_plan,
      item.required_plan
    );
  end loop;
end;
$$;

-- Itens de pedido herdam empresa/plano/cargo através do pedido pai.
do $$
begin
  if to_regclass('public.order_items') is not null then
    alter table public.order_items enable row level security;

    drop policy if exists orcaly_order_items_member
      on public.order_items;
    drop policy if exists orcaly_order_items_capability
      on public.order_items;
    drop policy if exists orcaly_order_items_plan
      on public.order_items;

    create policy orcaly_order_items_member
      on public.order_items
      as permissive
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_current_user_can(o.company_id, 'orders')
        )
      )
      with check (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_current_user_can(o.company_id, 'orders')
        )
      );

    create policy orcaly_order_items_capability
      on public.order_items
      as restrictive
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_current_user_can(o.company_id, 'orders')
        )
      )
      with check (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_current_user_can(o.company_id, 'orders')
        )
      );

    create policy orcaly_order_items_plan
      on public.order_items
      as restrictive
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_company_has_plan_access(o.company_id, 'essencial')
        )
      )
      with check (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_company_has_plan_access(o.company_id, 'essencial')
        )
      );
  end if;
end;
$$;

-- A empresa pode ser lida pelas policies existentes, mas configuração direta
-- só pode ser alterada pelo dono/admin e enquanto houver acesso ativo.
do $$
begin
  if to_regclass('public.companies') is not null then
    alter table public.companies enable row level security;

    drop policy if exists orcaly_company_update_member
      on public.companies;
    drop policy if exists orcaly_company_update_capability
      on public.companies;
    drop policy if exists orcaly_company_update_plan
      on public.companies;

    create policy orcaly_company_update_member
      on public.companies
      as permissive
      for update
      to authenticated
      using (public.orcaly_current_user_can(id, 'config'))
      with check (public.orcaly_current_user_can(id, 'config'));

    create policy orcaly_company_update_capability
      on public.companies
      as restrictive
      for update
      to authenticated
      using (public.orcaly_current_user_can(id, 'config'))
      with check (public.orcaly_current_user_can(id, 'config'));

    create policy orcaly_company_update_plan
      on public.companies
      as restrictive
      for update
      to authenticated
      using (public.orcaly_company_has_plan_access(id, 'essencial'))
      with check (public.orcaly_company_has_plan_access(id, 'essencial'));
  end if;
end;
$$;

-- Notas fiscais são Premium embora compartilhem financial_transactions.
do $$
begin
  if
    to_regclass('public.financial_transactions') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'financial_transactions'
        and column_name = 'origem'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'financial_transactions'
        and column_name = 'nota_numero'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'financial_transactions'
        and column_name = 'documento_url'
    )
  then
    drop policy if exists orcaly_financial_notes_premium
      on public.financial_transactions;

    create policy orcaly_financial_notes_premium
      on public.financial_transactions
      as restrictive
      for all
      to authenticated
      using (
        (
          lower(coalesce(origem, '')) <> 'nota_fiscal'
          and coalesce(nota_numero, '') = ''
          and coalesce(documento_url, '') = ''
        )
        or public.orcaly_company_has_plan_access(company_id, 'premium')
      )
      with check (
        (
          lower(coalesce(origem, '')) <> 'nota_fiscal'
          and coalesce(nota_numero, '') = ''
          and coalesce(documento_url, '') = ''
        )
        or public.orcaly_company_has_plan_access(company_id, 'premium')
      );
  end if;
end;
$$;

-- CRM e dados financeiros autoritativos passam somente pelas APIs service-role.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_leads',
    'marketplace_payment_settings',
    'marketplace_payments',
    'marketplace_commissions',
    'marketplace_commission_rules',
    'marketplace_oauth_states',
    'payment_webhook_events',
    'plan_payments'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'revoke all privileges on table public.%I from authenticated',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Views de proposta passam a obedecer RLS das tabelas-base.
do $$
begin
  if to_regclass('public.proposals_dashboard') is not null then
    execute 'alter view public.proposals_dashboard set (security_invoker = true)';
  end if;
end;
$$;

commit;
`);

console.log(`PATCH_CHANGED=${changed.length}`);
console.log(`PATCH_CREATED=${created.length}`);
console.log("ORCALY_PATCHER_OK=1");
