/** 在庫DOのテストで、Workersの実行環境を使わずにコンテキストを渡す。 */
export class DurableObjectFixture {
  constructor(protected ctx: DurableObjectState) {}
}
