import * as matchers from "@testing-library/jest-dom/matchers";
import { ResizeObserver } from "@juggle/resize-observer";
import { expect } from "vite-plus/test";

expect.extend(matchers);

// jsdomにないResizeObserverを補い、Radixのフォーム部品が行うサイズ計測を動かす。
globalThis.ResizeObserver ??= ResizeObserver;
