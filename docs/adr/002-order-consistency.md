# ADR 002: D1のOrder・在庫台帳、Durable Objectの在庫予約、Outbox

## ステータス

採用。注文管理・取消時の復元は[ADR 006](006-order-lifecycle.md)で拡張。

## 決定

Order・現在庫数・確定済み在庫割当をD1へ永続化し、D1を在庫台帳の正本とします。同一企業・SKUに
対する予約と在庫変更は、1つのDurable Objectインスタンスへルーティングします。Durable Object
ストレージには処理中の予約だけを保持し、現在庫数はリクエストごとにD1から読み取ります。
新しい商品の初期在庫だけは、商品と同じD1 batchで原子的に登録します。既存SKUの台帳は上書きせず、
登録後の入荷はDOで加算し、棚卸しは期待在庫を比較します。両方で予約数を保護し、台帳と変更履歴を同時に保存します。[ADR 031](031-product-initial-stock-and-inventory-management.md)を参照してください。

OrderのドメインイベントをOrderと同じD1バッチでOutboxへ書き込み、定期実行ハンドラーから
Cloudflare Queuesへ送信します。QueueコンシューマーはOrder確定後にDurable Object経由で予約を
確定し、D1の現在庫数を減らして注文単位の割当を記録します。割当IDを一意にすることで、
Queueの再配信でも在庫を重複して減らしません。

## 影響

- 1つのSKUに対する競合予約を、データベースロックなしで直列化できます。
- 在庫数はD1で参照でき、Durable Objectの内部ストレージを在庫台帳として扱わずに済みます。
- 注文確定から在庫割当の確定までは結果整合となり、その間はDurable Objectの予約が利用可能数を
  保護します。
- Orderの永続化とイベント送信の意図を、原子的に保存できます。
- Queue配信はat-least-onceのため、コンシューマーには冪等性が必要です。
- Order書き込みに失敗した場合、可能な範囲で予約を解放します。

## Entityの取得・保存境界

domainのInventoryRepositoryがInventoryItemの取得・保存契約を定義します。
D1DoInventoryRepositoryはD1台帳とDO予約の照合・復元、変更イベントに応じた保存を担当します。
DOはHTTP・企業/SKUの固定・直列化・Entityの業務操作を担当し、保存値からEntityを復元しません。
D1の行データとSQLはinfrastructure/inventory/sharedの内部部品へ閉じます。
取消時は復元後のStockReservationEntity<"restored">をRepositoryへ渡します。
取消印は復元より先に保存し、確定ではD1成功後にDO予約を削除します。分散トランザクションは追加しません。
在庫調整はInventoryRepository.saveAdjustmentへ変更済InventoryItemとStockAdjustmentEntryを渡し、現在庫と履歴を同じD1 batchへ保存します。履歴の再取得はStockAdjustmentRepository.findが復元済Entityを返します。読取・期待在庫の確認・保存までを企業・SKU単位のDOが直列化し、再送で在庫を二重更新しません。

## 確定済み割当と予約の照合

Repositoryの在庫読み込みでは、保存された予約IDをD1の確定済み割当と照合し、
確定後に残った予約を除去します。取消・復元済みの割当も冪等性の記録として照合対象に残します。

D1の[クエリごとのバインド変数上限](https://developers.cloudflare.com/d1/platform/limits/)は100個です。
企業IDとSKUに2個使うため、台帳アダプターは注文IDの重複を除き、最大98件ずつ順番に問い合わせます。
各問い合わせで企業・SKUの条件を維持し、結果を重複なく統合します。途中で問い合わせが失敗した場合は
部分結果を返さず、DOの予約を保持して次の要求で照合をやり直します。

DOの[非同期KV削除API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)は
1回128キーまでのため、照合後の不要な予約も128件ずつ削除します。削除の途中で失敗した場合は
要求を失敗として返し、新たな予約・解放・確定へ進みません。次の要求では保存済みの予約を読み直し、
削除できなかった残存分をD1と再照合します。既に削除した確定済み予約を戻したり、在庫数を変更したりしません。

検証では、空入力、98・99・100件と複数チャンク、重複ID、他企業・他SKU、照合途中の障害と再試行を確認します。
197件の予約を保持した状態で、読み込み・新規予約・解放・確定・確定の再配信が成功し、
確定済み予約を二重に差し引かないことをローカルD1で確認します。
不要な予約の削除も128・129・197件の境界と、後続バッチの削除失敗からの再試行を検証します。
