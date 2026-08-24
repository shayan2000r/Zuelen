import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // The existing application predates the React Compiler lint rules shipped
    // with ESLint 9 / Next 16. Keep them visible while allowing the established
    // server/action patterns to be migrated incrementally.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
