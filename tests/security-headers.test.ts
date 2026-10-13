import { expect, it } from "vite-plus/test";
import { withSecurityHeaders } from "@dev-template/config/security";

it("外部指定nonceを上書きし、HTMLをキャッシュせずクリックジャッキングを防ぐ", async () => {
  const seen: Request[] = [];
  const fetch = withSecurityHeaders(async (request: Request) => {
    seen.push(request);
    return new Response("<html></html>", {
      headers: { "Content-Type": "text/html", "Cache-Control": "public" },
    });
  });
  const first = await fetch(
    new Request("https://example.com/", {
      headers: { "x-csp-nonce": "forged", "Content-Security-Policy": "unsafe" },
    }),
  );
  const second = await fetch(new Request("https://example.com/"));
  expect(seen[0]!.headers.get("x-csp-nonce")).not.toBe("forged");
  expect(seen[0]!.headers.get("x-csp-nonce")).not.toBe(seen[1]!.headers.get("x-csp-nonce"));
  expect(first.headers.get("Content-Security-Policy")).toContain(
    `'nonce-${seen[0]!.headers.get("x-csp-nonce")}'`,
  );
  expect(first.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  expect(first.headers.get("Content-Security-Policy")).not.toContain(
    "unsafe-inline' 'strict-dynamic",
  );
  expect(first.headers.get("X-Frame-Options")).toBe("DENY");
  expect(first.headers.get("Cache-Control")).toBe("private, no-store");
  expect(first.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  expect(second.headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
});
it("ローカル開発だけevalとHMR接続を許可する", async () => {
  const fetch = withSecurityHeaders(() => new Response("ok"), { development: true });
  expect(
    (await fetch(new Request("http://localhost/"))).headers.get("Content-Security-Policy"),
  ).toContain("'unsafe-eval'");
  expect(
    (await fetch(new Request("https://public.example/"))).headers.get("Content-Security-Policy"),
  ).not.toContain("'unsafe-eval'");
});
