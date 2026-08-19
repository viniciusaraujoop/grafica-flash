import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These screens intentionally trigger an async initial load from an effect.
    // Their loading flag belongs to the external request lifecycle. Keep every
    // other hooks/compiler rule enabled and scope this exception to the loaders.
    files: [
      "app/admin/indicacoes/growth/page.tsx",
      "components/parceiros/PartnerDemoHub.tsx",
      "components/parceiros/PartnerNotificationsCenter.tsx",
      "components/parceiros/PartnerPipelineV2.tsx",
      "components/parceiros/PartnerPortalV2.tsx",
      "components/admin/AdminCompaniesV2.tsx",
      "components/admin/AdminUsersV2.tsx",
      "components/admin/AdminPaymentsV2.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
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
