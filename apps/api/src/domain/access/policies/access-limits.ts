// Accessの入力・保存境界が共用する制約。サービス固有の会員ID形式は別の値型が担う。
export const ACCESS_LIMITS = Object.freeze({
  nameMaxLength: 100,
  idMaxLength: 200,
  emailMaxLength: 254,
  permissionsMaxCount: 40,
});
