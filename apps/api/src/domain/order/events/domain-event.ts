/** 配信の再送でも同じidを使うイベントの値契約。payloadは集約そのものではなく保存可能な値。 */
export type DomainEvent<TName extends string = string, TPayload = unknown> = Readonly<{
  id: string;
  name: TName;
  aggregateId: string;
  occurredAt: string;
  payload: TPayload;
}>;
