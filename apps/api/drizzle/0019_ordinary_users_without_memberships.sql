-- 一般ユーザーは企業所属を持たない。会員・注文・監査履歴は維持し、旧ポータルの紐付けだけを解消する。
DELETE FROM customer_memberships;
--> statement-breakpoint
DELETE FROM invitations WHERE actor_kind = 'customer';
--> statement-breakpoint
-- 旧seedの一般ユーザー用ロールは、企業担当者や未承諾招待が使用していない場合だけ解消する。
DELETE FROM role_permissions WHERE access_roles_id IN (
  SELECT r.id FROM access_roles r WHERE r.id = r.scope || ':customer' AND r.name = '顧客'
  AND NOT EXISTS (SELECT 1 FROM business_memberships m WHERE m.access_roles_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM invitations i WHERE i.access_roles_id = r.id)
);
--> statement-breakpoint
DELETE FROM access_roles WHERE id = scope || ':customer' AND name = '顧客'
  AND NOT EXISTS (SELECT 1 FROM business_memberships m WHERE m.access_roles_id = access_roles.id)
  AND NOT EXISTS (SELECT 1 FROM invitations i WHERE i.access_roles_id = access_roles.id);
