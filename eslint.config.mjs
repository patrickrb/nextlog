import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // React 19 compiler rule that fires on the standard initial-data-fetch
      // pattern (useEffect on mount + setState with the result). Suppressing
      // 33 individual call sites is noisier than the warning itself; revisit
      // when we adopt a fetcher library (SWR/TanStack Query) that obviates
      // the pattern.
      "react-hooks/set-state-in-effect": "off",
      // Keeps catching the real stale-closure risk (function referenced
      // before declared in useEffect deps). Satisfied by wrapping fetchers
      // in useCallback.
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      // Standard convention: a leading underscore signals "intentionally
      // unused" (e.g. function-signature params kept for API compatibility).
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
