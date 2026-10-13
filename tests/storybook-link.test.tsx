import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Link } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { TestRouter } from "@dev-template/client/testing/router";
import { Button } from "@dev-template/ui/button";

afterEach(cleanup);

// Story用のmemory RouterでもButtonのasChildからref・リンク名が届く契約を維持する。
describe("Storybookで使う公式Routerのリンク", () => {
  it("合成したボタンでも遷移先・アクセシブル名・refを保持する", () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Button asChild>
        <Link<AnyRouter> ref={ref} to="/organizations/tenant-a/products" aria-label="商品へ">
          商品
        </Link>
      </Button>,
      { wrapper: TestRouter },
    );
    const link = screen.getByRole("link", { name: "商品へ" });
    expect(link).toHaveAttribute("href", "/organizations/tenant-a/products");
    expect(ref.current).toBe(link);
  });

  it("利用側のクリック処理でmemory Routerの遷移を取り消せる", () => {
    const onClick = vi.fn((event: import("react").MouseEvent<HTMLAnchorElement>) =>
      event.preventDefault(),
    );
    render(
      <Link<AnyRouter> to="/organizations/tenant-a" onClick={onClick}>
        企業へ
      </Link>,
      { wrapper: TestRouter },
    );
    expect(fireEvent.click(screen.getByRole("link", { name: "企業へ" }))).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0].defaultPrevented).toBe(true);
  });
});
