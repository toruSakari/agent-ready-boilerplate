/// <reference types="vite/client" />
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { cleanup } from "@testing-library/react";
import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import preview from "@/.storybook/preview";

vi.mock(
  "#client/shared/api/authenticated-fetch",
  () => import("@/.storybook/mocks/authenticated-fetch"),
);

const annotations = setProjectAnnotations(preview);
const storyFiles = import.meta.glob<Parameters<typeof composeStories>[0]>(
  [
    "/packages/ui/src/**/*.stories.tsx",
    "/packages/client/src/**/*.stories.tsx",
    "/apps/*/src/**/*.stories.tsx",
  ],
  { eager: true },
);

// 表示部品の追加時にStoryの抜けを検出する。shadcn/uiと描画を持たないproviderは対象外。
const uiFiles = import.meta.glob<string>(
  [
    "/packages/client/src/**/ui/**/*.tsx",
    "/apps/web/src/**/ui/**/*.tsx",
    "/apps/business/src/**/ui/**/*.tsx",
    "/apps/admin/src/**/ui/**/*.tsx",
    "!**/*.stories.tsx",
    "!**/*.test.tsx",
    "!**/invitation-provider.tsx",
  ],
  { eager: true, query: "?raw", import: "default" },
);

it("shadcn/ui以外の表示コンポーネントは自身の隣接Storyを持つ", () => {
  const missingStories = Object.entries(uiFiles)
    // 再公開だけのindex・入口はコンポーネントの実装ではない。
    .filter((props) => {
      const [, source] = props;
      return /export\s+(?:default\s+)?(?:function|const|class)\s/.test(source);
    })
    .map((props) => props[0].replace(/\.tsx$/, ".stories.tsx"))
    .filter((file) => !(file in storyFiles));
  expect(missingStories).toEqual([]);
});

const objectUrlDescriptors = Object.fromEntries(
  ["createObjectURL", "revokeObjectURL"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(URL, name),
  ]),
);

beforeAll(annotations.beforeAll);
beforeAll(() => {
  // 未定義fixtureが実ネットワークへ漏れないよう、すべての通信を失敗として捕捉する。
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.reject(new Error("Storybookのテストからネットワーク通信を行ってはいけません")),
    ),
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  // 実コンポーネントが使うBlob画像APIだけを補い、jsdomにないブラウザー機能を代替する。
  URL.createObjectURL = vi.fn(() => "blob:storybook-sample");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  expect(document.body.textContent).not.toContain("Storybook fixture is missing:");
  cleanup();
  expect(fetch).not.toHaveBeenCalled();
  vi.clearAllMocks();
});
afterAll(() => {
  for (const [name, descriptor] of Object.entries(objectUrlDescriptors)) {
    if (descriptor) {
      Object.defineProperty(URL, name, descriptor);
    } else {
      Reflect.deleteProperty(URL, name);
    }
  }

  vi.unstubAllGlobals();
});

for (const [file, stories] of Object.entries(storyFiles)) {
  describe(`Storybookの描画・操作: ${file}`, () => {
    for (const [name, story] of Object.entries(composeStories(stories))) {
      it(`${name}の描画・操作を検証する`, async () => {
        if (typeof story !== "function" || !("run" in story) || typeof story.run !== "function") {
          throw new Error(`合成したstoryの形式が不正です: ${name}`);
        }

        await story.run();
      });
    }
  });
}
