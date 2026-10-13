import { t as translate } from "#client/shared/i18n";
import { Link } from "@tanstack/react-router";
import type { AnyRouter, ErrorComponentProps } from "@tanstack/react-router";
import { RouteError } from "#client/_app/navigation/route-error";
import { Button } from "@dev-template/ui/button";

export function RouteAccessError(props: ErrorComponentProps) {
  return (
    <main>
      <RouteError error={props.error} reset={props.reset} />
      <Button asChild variant="outline">
        <Link<AnyRouter> to="/account">{translate("登録情報・退会")}</Link>
      </Button>
    </main>
  );
}
