export type InventoryNamespace = {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): Pick<DurableObjectStub, "fetch">;
};

/** 旧企業のDO名を維持し、新企業は企業・SKUの複合名を使う。 */
export function inventoryStub(
  namespace: InventoryNamespace,
  tenantNamespace: InventoryNamespace,
  legacyTenantId: string,
  tenantId: string,
  sku: string,
) {
  const selected = tenantId === legacyTenantId ? namespace : tenantNamespace;
  return selected.get(
    selected.idFromName(tenantId === legacyTenantId ? sku : JSON.stringify([tenantId, sku])),
  );
}
