import { mocks } from "#client/test/access-qualification/mocks";
import { TestRouter } from "#client/test/router";
import { focusManager, onlineManager, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderReact,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { QUERY_POLICY } from "#client/_app/providers/query-policy";
import { AuthenticationGate, ServiceQualificationGate } from "#client/_app/guards";
import { AppProviders } from "#client/_app/providers/app-providers";
import { ConsoleLayout, OrganizationPicker } from "#client/widgets/access-console";
import type { Service } from "#client/shared/api/client-context";
import { useAccessSession } from "#client/entities/access";
import { useAccessMutations } from "#client/features/manage-access";
import { useTRPC } from "#client/shared/api/trpc";
import { ProtectedPage } from "#client/test/access-qualification/protected-page";

import { InviteWorkflow } from "#client/test/access-qualification/invite-workflow";

import { AcceptMembership } from "#client/test/access-qualification/accept-membership";

import { DeniedAction } from "#client/test/access-qualification/denied-action";

import { RefreshSession } from "#client/test/access-qualification/refresh-session";

const render = (ui: import("react").ReactNode) => renderReact(ui, { wrapper: TestRouter });

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useLocation: () => ({ pathname: window.location.pathname }),
}));
vi.mock("next-themes", () => ({
  ThemeProvider: (props: { children: ReactNode }) => props.children,
}));
vi.mock("#client/features/switch-theme", () => ({
  DEFAULT_THEME: "system",
  THEME_STORAGE_KEY: "test-theme",
  ThemeMenu: () => null,
}));
vi.mock("@clerk/react", () => ({
  ClerkProvider: (props: { children: ReactNode }) => props.children,
  useAuth: () => mocks.auth,
  SignIn: () => null,
}));
let fetchSession: ReturnType<typeof vi.fn<typeof fetch>>;
let fetchRegistration: ReturnType<typeof vi.fn<typeof fetch>>;
const services: Service[] = ["operator", "business", "customer"];

function qualified(userId = mocks.auth.userId) {
  return Response.json([
    {
      result: {
        data: {
          userId,
          organizations: [],
          platformPermissions: [],
          permissions: [],
          permissionCatalog: {},
        },
      },
    },
  ]);
}

function forbidden() {
  return Response.json(
    [
      {
        error: {
          message: "この画面を利用する権限がありません",
          code: -32003,
          data: { code: "FORBIDDEN", httpStatus: 403, path: "access.session" },
        },
      },
    ],
    { status: 403 },
  );
}

function navigate(path: string) {
  window.history.replaceState(null, "", path);
}

function app(service: Service = "business", organizationId?: string) {
  return (
    <AppProviders service={service} organizationId={organizationId}>
      <AuthenticationGate>
        <ServiceQualificationGate service={service}>
          <ProtectedPage />
        </ServiceQualificationGate>
      </AuthenticationGate>
    </AppProviders>
  );
}

function expectProtectedAbsent() {
  expect(screen.queryByRole("heading", { name: "保護された画面" })).toBeNull();
  expect(screen.queryByRole("link", { name: "企業選択・ホーム" })).toBeNull();
  expect(screen.queryByRole("button", { name: "業務操作" })).toBeNull();
}

function requestUrl(index = 0) {
  const input = fetchSession.mock.calls[index]?.[0];
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input?.url;
}

function requestHeaders(index = 0) {
  return new Headers(fetchSession.mock.calls[index]?.[1]?.headers);
}

function fetchUrl(input: Parameters<typeof fetch>[0]) {
  return input instanceof Request ? input.url : String(input);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_qualification");
  window.sessionStorage.clear();
  navigate("/");
  mocks.auth.isLoaded = true;
  mocks.auth.isSignedIn = true;
  mocks.auth.userId = "qualified-user";
  mocks.auth.getToken.mockReset().mockResolvedValue("test-token");
  mocks.renderProtected.mockClear();
  mocks.mountProtected.mockClear();
  mocks.unmountProtected.mockClear();
  fetchSession = vi.fn<typeof fetch>().mockImplementation(async () => qualified());
  fetchRegistration = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const url = fetchUrl(input);
    return Response.json([
      {
        result: {
          data: {
            registered: true,
            accountId: mocks.auth.userId,
            category: JSON.parse(
              new URL(url, window.location.origin).searchParams.get("input") ?? "{}",
            )["0"].service,
          },
        },
      },
    ]);
  });
  vi.stubGlobal("fetch", ((input, init) =>
    fetchUrl(input).includes("access.registration")
      ? fetchRegistration(input, init)
      : fetchSession(input, init)) satisfies typeof fetch);
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
});
afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

export {
  TestRouter,
  focusManager,
  onlineManager,
  useMutation,
  useQueryClient,
  act,
  cleanup,
  fireEvent,
  renderReact,
  screen,
  waitFor,
  StrictMode,
  useEffect,
  useState,
  type ReactNode,
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
  QUERY_POLICY,
  AuthenticationGate,
  ServiceQualificationGate,
  AppProviders,
  ConsoleLayout,
  OrganizationPicker,
  type Service,
  useAccessSession,
  useAccessMutations,
  useTRPC,
  render,
  mocks,
  fetchSession,
  fetchRegistration,
  services,
  qualified,
  forbidden,
  navigate,
  ProtectedPage,
  InviteWorkflow,
  AcceptMembership,
  DeniedAction,
  RefreshSession,
  app,
  expectProtectedAbsent,
  requestUrl,
  requestHeaders,
  fetchUrl,
};
