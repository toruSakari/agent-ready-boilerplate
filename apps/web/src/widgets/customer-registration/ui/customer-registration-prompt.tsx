import { t as translate } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { CUSTOMER_REGISTRATION_PATH } from "#web/widgets/customer-registration/model/routes.ts";

/** webの資格ガードと会員画面へ渡す登録導線。共有UIは/registerや顧客登録の方針を持たない。 */
export function CustomerRegistrationPrompt() {
  return (
    <>
      <p>{translate("会員登録すると、商品を購入できます。企業への所属や招待は必要ありません。")}</p>
      <Button asChild>
        <a href={CUSTOMER_REGISTRATION_PATH}>{translate("会員登録へ進む")}</a>
      </Button>
    </>
  );
}
