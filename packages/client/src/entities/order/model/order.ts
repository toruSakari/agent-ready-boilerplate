import type { RouterInputs, RouterOutputs } from "@dev-template/api-types";

// 入力と一覧の型はそれぞれのAPI契約から導出する。画面にサーバー集約の実行コードを持ち込まない。
export type OrderLine = RouterInputs["order"]["create"]["lines"][number];

export type OrderSnapshot = RouterOutputs["order"]["list"][number];
