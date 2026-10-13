import { BusinessAccountEntity } from "#api/domain/access/entities/business-account.ts";
import { CustomerAccountEntity } from "#api/domain/access/entities/customer-account.ts";
import { OperatorAccountEntity } from "#api/domain/access/entities/operator-account.ts";
import { restoreStoredServiceAccount } from "#api/infrastructure/access/mappers/restore-stored-service-account.ts";
import { expect, it } from "vite-plus/test";

const base = {
  id: "customer:member",
  name: "会員",
  email: "member@example.com",
  deleted: 0,
  subject_id: "verified-subject",
  category: "customer",
};
const services = [
  { category: "customer", entity: CustomerAccountEntity, inactiveStatus: "withdrawn" },
  { category: "business", entity: BusinessAccountEntity, inactiveStatus: "withdrawn" },
  { category: "operator", entity: OperatorAccountEntity, inactiveStatus: "stopped" },
] as const;

it.each(services)(
  "サービス会員の保存データ復元 / $categoryを対応する有効な会員として復元する",
  (props) => {
    const account = restoreStoredServiceAccount({
      ...base,
      id: `${props.category}:member`,
      category: props.category,
    });
    expect(account).toBeInstanceOf(props.entity);
    expect(account).toMatchObject({
      id: `${props.category}:member`,
      subjectId: base.subject_id,
      category: props.category,
      name: base.name,
      email: base.email,
      status: "active",
      deleted: false,
    });
    expect(Object.isFrozen(account)).toBe(true);
  },
);

it.each(services)(
  "サービス会員の保存データ復元 / $categoryの匿名化された終了状態と元の本人確認IDを復元する",
  (props) => {
    const account = restoreStoredServiceAccount({
      ...base,
      id: `${props.category}:member`,
      category: props.category,
      deleted: 1,
      name: "削除済みユーザー",
      email: null,
    });
    expect(account).toBeInstanceOf(props.entity);
    expect(account).toMatchObject({
      id: `${props.category}:member`,
      subjectId: base.subject_id,
      category: props.category,
      name: "削除済みユーザー",
      email: null,
      status: props.inactiveStatus,
      deleted: true,
    });
    expect(Object.isFrozen(account)).toBe(true);
  },
);

it.each(services)(
  "サービス会員の保存データ復元 / $categoryの移行済み履歴の名前・連絡先を保持して終了状態を復元する",
  (props) => {
    const account = restoreStoredServiceAccount({
      ...base,
      id: `${props.category}:member`,
      category: props.category,
      deleted: 1,
    });
    expect(account).toMatchObject({
      status: props.inactiveStatus,
      deleted: true,
      name: base.name,
      email: base.email,
      subjectId: base.subject_id,
    });
  },
);

it.each(services)(
  "サービス会員の保存データ復元 / $categoryのIDが別サービスに属する保存行を拒否する",
  (props) => {
    for (const other of services.filter((service) => service.category !== props.category)) {
      expect(() =>
        restoreStoredServiceAccount({
          ...base,
          id: `${other.category}:member`,
          category: props.category,
        }),
      ).toThrow();
    }
  },
);

it.each(services)(
  "サービス会員の保存データ復元 / $categoryのメールが未登録の既存会員を復元する",
  (props) => {
    const account = restoreStoredServiceAccount({
      ...base,
      id: `${props.category}:member`,
      category: props.category,
      email: null,
    });
    expect(account).toBeInstanceOf(props.entity);
    expect(account.status).toBe("active");
    expect(account.email).toBeNull();
    expect(account.deleted).toBe(false);
  },
);

it.each(services)(
  "サービス会員の保存データ復元 / $categoryの本人確認IDを変更せず復元する",
  (props) => {
    const subjectId = ` ${"opaque-subject".repeat(20)} `;
    const account = restoreStoredServiceAccount({
      ...base,
      id: `${props.category}:member`,
      category: props.category,
      subject_id: subjectId,
    });
    expect(account.subjectId).toBe(subjectId);
  },
);

it.each([
  null,
  {},
  { ...base, id: "" },
  { ...base, id: "customer:" },
  { ...base, id: "member" },
  { ...base, name: " " },
  { ...base, email: "invalid" },
  { ...base, email: undefined },
  { ...base, subject_id: "" },
  { ...base, subject_id: " " },
  { ...base, subject_id: null },
  { ...base, subject_id: undefined },
  { ...base, category: "unknown" },
  { ...base, category: undefined },
  { ...base, deleted: -1 },
  { ...base, deleted: 2 },
  { ...base, deleted: true },
  { ...base, deleted: "0" },
  { ...base, deleted: undefined },
])("サービス会員の保存データ復元 / 不正な保存値を拒否する", (value) => {
  expect(() => restoreStoredServiceAccount(value)).toThrow();
});
