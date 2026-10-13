import type { AccessRecords } from "#api/domain/access/repositories/access-repository.ts";

/** 管理一覧のために復元済みの会員Entityをまとめる。登録・退会のライフサイクルは共有しない。 */
export function accountDirectory(state: AccessRecords) {
  return [...state.customerAccounts, ...state.businessAccounts, ...state.operatorAccounts];
}
