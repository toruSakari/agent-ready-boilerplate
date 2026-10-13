import { InventoryReservation } from "#api/infrastructure/inventory/durable-objects/inventory-reservation.ts";

// 新企業は旧SKU単独の名前空間とは分け、旧SKUと複合キーの衝突を防ぐ。
export class TenantInventoryReservation extends InventoryReservation {}
