import { useEffect } from "react";
import { ConsoleLayout } from "#client/widgets/access-console";
import { useAccessSession } from "#client/entities/access";
import { mocks } from "#client/test/access-qualification/mocks";

export function ProtectedPage() {
  mocks.renderProtected();
  const session = useAccessSession();
  useEffect(() => {
    mocks.mountProtected();
    return () => mocks.unmountProtected();
  }, []);
  return (
    <ConsoleLayout title="保護された画面">
      <button type="button">業務操作</button>
      <p>操作権限数：{session.data?.permissions.length}</p>
    </ConsoleLayout>
  );
}
