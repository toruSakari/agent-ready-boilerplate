import type { RouterOutputs } from "@dev-template/api-types";

// 全体ディレクトリはadminが所有し、画面の型だけをAPI応答から導出する。
export type AccessOrganization = RouterOutputs["access"]["organizations"][number];

export type AccessUser = RouterOutputs["access"]["users"][number];
