# Repository構成の調査

確認日: 2026-10-11。

## 確認した事実

- [Symfony / Doctrine](https://symfony.com/doc/current/doctrine.html#querying-for-objects-the-repository)は、独自検索をProductRepositoryのメソッドに追加する例を示す。保存の確定はEntityManagerが担当する。
- [Spring Data JPA](https://docs.spring.io/spring-data/jpa/reference/repositories/custom-implementations.html)は、独自機能をfragmentのinterfaceと実装で分割する。
- [NestJS / TypeORM](https://docs.nestjs.com/data/typeorm)は、ServiceへRepositoryを注入する基本例を示す。取得・削除ごとの関数ファイルは作っていない。

## 採用する判断

利用者の要望に従い、取得・保存の入口と処理をRepository本体へまとめる。基本例から読みやすさの方針を参考にするもので、各フレームワークが複雑なD1実装の配置まで規定しているとは解釈しない。

ORMの自動実装やEntityManagerへの変更は採用しない。現在のEntity契約・Drizzle・D1 batch・監査・Outboxを維持する。
SQL組み立てが複雑な所属・招待・退会処理は独立した部品として残す。Accessの集約境界と全体共通の競合番号は今回の整理対象外とし、別途検討する。

## 受け入れ条件

- Accessのload・commit、注文の更新処理がRepository本体で追える。
- 操作ごとの委譲ファイルへの参照が残らない。
- 既存の実DB結合テストと型契約で、認可・競合・監査・Outboxの動作が維持される。

## 一覧の取得契約

確認したRepositoryの基本例はEntityを検索・返却する。Query/CQRSを別に設ける設計も選択肢であり、この調査から採用数の多数派は判断しない。利用者の指定を優先し、本テンプレートのUseCaseは一覧・集計もRepositoryの復元済みEntityから作る。表示DTO専用QueryはUseCaseへ注入しない。詳細は[ADR 033](../adr/033-repository-responsibilities.md)を参照する。
