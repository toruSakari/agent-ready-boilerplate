import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { RoleEditor } from "#client/features/manage-access/ui/role-editor";

afterEach(cleanup);

// プラン外になった保存済み権限の維持・削除と、新しい権限の追加可能性を別々に検証する。
it(
  "プランの制約を考慮するロール編集" +
    " / " +
    "新しいロールにはサーバーの権限一覧にある選択肢だけを表示する",
  () => {
    render(
      <RoleEditor
        catalog={{ "order:read": "注文閲覧" }}
        permissionLabels={{ "order:read": "注文閲覧", "plan.manage": "プランの割当管理" }}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "注文閲覧" })).toBeEnabled();
    expect(screen.queryByRole("checkbox", { name: "プランの割当管理" })).not.toBeInTheDocument();
  },
);

it(
  "プランの制約を考慮するロール編集" +
    " / " +
    "利用できなくなった保存済み権限はラベルを付けて削除可能にし、再追加は拒否する",
  async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(
      <RoleEditor
        catalog={{ "order:read": "注文閲覧" }}
        permissionLabels={{ "order:read": "注文閲覧", "product.update": "商品管理" }}
        initial={{ name: "担当者", permissions: ["order:read", "product.update"] }}
        onSubmit={onSubmit}
      />,
    );
    const unavailable = screen.getByRole("checkbox", { name: "商品管理" });
    expect(unavailable).toBeChecked();
    expect(unavailable).toBeEnabled();
    await user.click(unavailable);
    expect(unavailable).not.toBeChecked();
    expect(unavailable).toBeDisabled();
    await user.click(unavailable);
    expect(unavailable).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "ロールを保存" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: "担当者", permissions: ["order:read"] }),
    );
  },
);

it(
  "プランの制約を考慮するロール編集" +
    " / " +
    "ロール名だけを変更した場合は利用できなくなった保存済み権限を保持する",
  async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(
      <RoleEditor
        catalog={{}}
        permissionLabels={{ "product.update": "商品管理" }}
        initial={{ name: "担当者", permissions: ["product.update"] }}
        onSubmit={onSubmit}
      />,
    );
    await user.clear(screen.getByLabelText("ロール名"));
    await user.type(screen.getByLabelText("ロール名"), "新しい担当者");
    await user.click(screen.getByRole("button", { name: "ロールを保存" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "新しい担当者",
        permissions: ["product.update"],
      }),
    );
  },
);

it(
  "プランの制約を考慮するロール編集" +
    " / " +
    "編集中に権限一覧が変わっても選択済みの権限を表示し続ける",
  async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const labels = { "product.update": "商品管理" };
    const view = render(
      <RoleEditor catalog={labels} permissionLabels={labels} onSubmit={onSubmit} />,
    );
    await user.click(screen.getByRole("checkbox", { name: "商品管理" }));
    view.rerender(<RoleEditor catalog={{}} permissionLabels={labels} onSubmit={onSubmit} />);
    expect(screen.getByRole("checkbox", { name: "商品管理" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "商品管理" }));
    expect(screen.queryByRole("checkbox", { name: "商品管理" })).not.toBeInTheDocument();
  },
);

it(
  "プランの制約を考慮するロール編集" +
    " / " +
    "ブラウザー標準の検証を無効にしてもReact Hook Formの検証を維持する",
  async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<RoleEditor catalog={{}} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("ロール名").closest("form")).toHaveAttribute("novalidate");
    await user.click(screen.getByRole("button", { name: "ロールを保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ロール名を入力してください");
    expect(onSubmit).not.toHaveBeenCalled();
  },
);
