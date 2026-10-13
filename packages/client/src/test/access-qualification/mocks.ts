import { vi } from "vite-plus/test";

export const mocks = {
  auth: {
    isLoaded: true,
    isSignedIn: true,
    userId: "qualified-user" as string | null,
    getToken: vi.fn<() => Promise<string | null>>(),
  },
  renderProtected: vi.fn(),
  mountProtected: vi.fn(),
  unmountProtected: vi.fn(),
};
