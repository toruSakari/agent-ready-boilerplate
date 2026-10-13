import * as matchers from "@testing-library/jest-dom/matchers";
import { ResizeObserver } from "@juggle/resize-observer";
import { expect } from "vite-plus/test";

expect.extend(matchers);

// jsdomにはResizeObserverがないため、Radixのフォーム部品が寸法を計測できるよう補う。
globalThis.ResizeObserver ??= ResizeObserver;
