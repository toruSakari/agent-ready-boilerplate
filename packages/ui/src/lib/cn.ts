import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 条件付きクラスを組み立ててからTailwindの競合を解決し、利用側のclassNameで共通の見た目を調整できるようにする。
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
