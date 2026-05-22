/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
  {
    files: ["packages/api/**/*.ts", "packages/ui/**/*.{ts,tsx}"],
    rules: {},
  },
];
