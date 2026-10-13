import { cleanup, render, renderHook, screen, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it } from "vite-plus/test";
import { StoryProviders } from "@/.storybook/fixtures";
import { InvitationCategory } from "#client/widgets/access-console/ui/invitation-category";
import { useScopeInvitation } from "#client/widgets/access-console/model/use-scope-invitation";

afterEach(cleanup);

it.each(["business", "admin"] as const)("%sの招待先をサービスに応じて限定する", (mode) => {
  const wrapper = (props: { children: ReactNode }) => (
    <StoryProviders fixtures={{ mode }}>{props.children}</StoryProviders>
  );
  const { result } = renderHook(() => useScopeInvitation("demo-store", []), { wrapper });
  render(<InvitationCategory scope="demo-store" state={result.current} />);
  expect(screen.getByRole("option", { name: "事業者" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "顧客" })).not.toBeInTheDocument();
  act(() => result.current.changeCategory("customer"));
  expect(result.current.inviteCategory).toBe("business");
});
