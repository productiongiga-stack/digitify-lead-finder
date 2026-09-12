import path from "node:path";

export const authStateDir = path.resolve(process.cwd(), "test-results", ".auth");

export function authStatePath(name: string) {
  return path.join(authStateDir, `${name}.json`);
}
