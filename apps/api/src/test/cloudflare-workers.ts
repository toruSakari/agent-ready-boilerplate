// Node・jsdomのテストでWorkers APIを暗黙に使わせない。必要なテストがvi.mockを明示する。
export class DurableObject<T> {
  protected ctx: DurableObjectState;

  constructor(ctx: DurableObjectState, _env: T) {
    this.ctx = ctx;
    throw new Error("Cloudflare WorkersのAPIはテストで明示的にモックしてください");
  }
}
