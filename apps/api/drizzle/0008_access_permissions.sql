-- 権限コードはAPI実装と同じ変更で追加する。ローカル用ユーザーは含めない。
INSERT INTO access_revision (id,version,mutation_id) VALUES ('access',0,'initial');
INSERT INTO permissions (code,name) VALUES ('organization.read','企業一覧の閲覧');
INSERT INTO permissions (code,name) VALUES ('organization.manage','企業の作成・変更・停止');
INSERT INTO permissions (code,name) VALUES ('user.read','全ユーザーの基本情報閲覧');
INSERT INTO permissions (code,name) VALUES ('user.personal.read','個人情報の閲覧');
INSERT INTO permissions (code,name) VALUES ('user.delete','アカウント削除');
INSERT INTO permissions (code,name) VALUES ('member.read','メンバー閲覧');
INSERT INTO permissions (code,name) VALUES ('member.invite','メンバー招待');
INSERT INTO permissions (code,name) VALUES ('member.assign_role','メンバーのロール変更');
INSERT INTO permissions (code,name) VALUES ('member.remove','所属解除');
INSERT INTO permissions (code,name) VALUES ('role.manage','カスタムロール管理');
INSERT INTO permissions (code,name) VALUES ('audit.read','監査ログ閲覧');
INSERT INTO permissions (code,name) VALUES ('order:read','注文閲覧');
INSERT INTO permissions (code,name) VALUES ('order:create','注文作成');
INSERT INTO permissions (code,name) VALUES ('order:update','注文変更');
INSERT INTO permissions (code,name) VALUES ('product.read','商品閲覧');
INSERT INTO permissions (code,name) VALUES ('product.update','商品管理');
