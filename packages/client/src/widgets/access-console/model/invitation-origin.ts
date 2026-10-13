import { t, UserFacingError } from "#client/shared/i18n";
import type { ServiceCategory } from "#client/entities/access";
import type { Service } from "#client/shared/api/client-context";

/** 招待先のサービスoriginを明示する。未設定の実環境では推測しない。 */
export function invitationOrigin(category: ServiceCategory, service: Service, location: Location) {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (category === "operator") {
    return location.origin;
  }

  if (category === "customer") {
    return process.env.NEXT_PUBLIC_CUSTOMER_ORIGIN ?? (local ? "http://127.0.0.1:5173" : "");
  }

  if (service === "business") {
    return location.origin;
  }

  return process.env.NEXT_PUBLIC_BUSINESS_ORIGIN ?? (local ? "http://127.0.0.1:5174" : "");
}

export function invitationLink(category: ServiceCategory, service: Service, token: string) {
  const origin = invitationOrigin(category, service, window.location);
  if (!origin) {
    throw new UserFacingError(
      t(
        "招待先の画面URLが設定されていません。登録先サービスに対応するNEXT_PUBLIC_BUSINESS_ORIGINまたはNEXT_PUBLIC_CUSTOMER_ORIGINを設定してください",
      ),
    );
  }

  // 秘密をクエリに載せず、入口で回収するfragmentへ置く。
  return `${origin}/invitations/accept#${token}`;
}
