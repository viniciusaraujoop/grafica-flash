import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Arquivos que nao fazem parte da aplicacao executada.
    ".orcaly-backups/**",
    ".orcaly-*/**",
    "pacote-*/**",
    "orcaly-payment-flows-phase1/**",
    "orcaly-payment-flows-phase1.mjs",
    "orcaly-payment-flows-phase1.zip",
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
