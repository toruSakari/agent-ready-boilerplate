import { describe, expect, it } from "vite-plus/test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { setupLocalClerk } from "#tooling/setup-clerk.mjs";

describe("ローカルClerk設定", () => {
  it("APIのデモ認証を無効にし、4アプリの鍵を揃えて既存設定を保持する", () => {
    const root = mkdtempSync(join(tmpdir(), "clerk-setup-"));
    try {
      for (const app of ["api", "web", "business", "admin"]) {
        mkdirSync(join(root, "apps", app), { recursive: true });
        writeFileSync(
          join(root, "apps", app, ".dev.vars.example"),
          "APP_ENV=local\nAUTH_MODE=demo\nOTHER=keep\n",
        );
      }

      writeFileSync(
        join(root, "source.env"),
        "CLERK_SECRET_KEY=sk_test_fixture\nVITE_CLERK_PUBLISHABLE_KEY=pk_test_fixture\n",
      );
      setupLocalClerk(root, "source.env");
      setupLocalClerk(root, "source.env");
      for (const app of ["api", "web", "business", "admin"]) {
        const vars = parseEnv(readFileSync(join(root, "apps", app, ".dev.vars"), "utf8"));
        expect(vars.CLERK_SECRET_KEY).toBe("sk_test_fixture");
        expect(vars.OTHER).toBe("keep");
        if (app === "api") {
          expect(vars.AUTH_MODE).toBe("clerk");
        } else {
          const publicContents = readFileSync(join(root, "apps", app, ".env.local"), "utf8");
          expect(parseEnv(publicContents).NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe(
            "pk_test_fixture",
          );
          expect(publicContents).not.toContain("sk_test_");
        }
      }

      writeFileSync(
        join(root, "source.env"),
        "CLERK_SECRET_KEY=sk_live_fixture\nVITE_CLERK_PUBLISHABLE_KEY=pk_live_fixture\n",
      );
      expect(() => setupLocalClerk(root, "source.env")).toThrow();
      expect(parseEnv(readFileSync(join(root, "apps/api/.dev.vars"), "utf8")).AUTH_MODE).toBe(
        "clerk",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
