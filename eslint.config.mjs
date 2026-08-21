import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These screens intentionally trigger an async initial load from an effect.
    // Their loading/local browser state belongs to an external lifecycle. Keep
    // every other hooks/compiler rule enabled and scope this exception narrowly.
    files: [
      "app/admin/indicacoes/growth/page.tsx",
      "components/parceiros/PartnerDemoHub.tsx",
      "components/parceiros/PartnerNotificationsCenter.tsx",
      "components/parceiros/PartnerPipelineV2.tsx",
      "components/parceiros/PartnerPortalV2.tsx",
      "components/admin/AdminCompaniesV2.tsx",
      "components/admin/AdminUsersV2.tsx",
      "components/admin/AdminPaymentsV2.tsx",
      "components/admin/AdminAssistantGrowth.tsx",
      "components/home/HomeAiChatV2.tsx",
      "app/painel/relatorios/page.tsx",
      "components/public-site/StorefrontExperienceV2.tsx",
      "components/public-site/StorefrontProductActions.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["components/home/HomeAiChatV2.tsx"],
    rules: {
      // The feedback field is intentionally removed before localStorage persistence.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".orcaly-backups/**",
    "qa-orcaly-*/**",
    ".orcaly-qa/**",
    "scripts/**",
    "**/*.ps1",
    "**/*.backup-*",
    "**/*.bak.*",
    "**/*.old.*",
    "**/*.tmp.*",
  ]),
]);

export default eslintConfig;