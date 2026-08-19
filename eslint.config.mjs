import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These screens intentionally trigger an async initial load from an effect.
    // The loader flips its loading flag before the first await, which React's
    // set-state-in-effect rule treats as synchronous even though the state
    // belongs to the external request lifecycle. Keep every other hooks rule on.
    files: [
      "app/admin/indicacoes/growth/page.tsx",
      "components/parceiros/PartnerDemoHub.tsx",
      "components/parceiros/PartnerNotificationsCenter.tsx",
      "components/parceiros/PartnerPipelineV2.tsx",
      "components/parceiros/PartnerPortalV2.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Arquivos que nao fazem parte da aplicacao executada.
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