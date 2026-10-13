import { InventoryNotFoundError } from "#api/infrastructure/inventory/durable-objects/inventory-not-found-error.ts";
import { changeStock } from "#api/infrastructure/inventory/durable-objects/change-stock.ts";
import { reservationSchema } from "#api/infrastructure/inventory/durable-objects/inventory-input.ts";
import type { Reservation } from "#api/infrastructure/inventory/durable-objects/inventory-input.ts";
import { inventoryOperation } from "#api/infrastructure/inventory/durable-objects/inventory-operation.ts";
import { defineLogEvent, logEvent } from "@dev-template/config/logging";
import {
  DEFAULT_LEGACY_INVENTORY_TENANT_ID,
  INVENTORY_TENANT_STORAGE_KEY,
  INVENTORY_TENANT_HEADER,
} from "#api/infrastructure/inventory/shared/inventory-scope.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { InvalidReservationError } from "#api/domain/inventory/errors/invalid-reservation-error.ts";
import { InvalidReservationTransitionError } from "#api/domain/inventory/errors/invalid-reservation-transition-error.ts";
import { ZodError } from "zod";
import { DurableObject } from "cloudflare:workers";
import { InsufficientStockError } from "#api/domain/inventory/errors/insufficient-stock-error.ts";
import { InvalidInventoryError } from "#api/domain/inventory/errors/invalid-inventory-error.ts";
import { InventoryItem } from "#api/domain/inventory/entities/inventory-item.ts";
import type { InventoryRepository } from "#api/domain/inventory/repositories/inventory-repository.ts";
import { D1DoInventoryRepository } from "#api/infrastructure/inventory/repositories/d1-do-inventory-repository.ts";

import { adjustStock } from "#api/infrastructure/inventory/durable-objects/adjust-stock.ts";
import { D1StockAdjustmentRepository } from "#api/infrastructure/inventory/repositories/d1-stock-adjustment-repository.ts";

const inventoryFailed = defineLogEvent("inventory_failed", "在庫API処理に失敗しました", []);

export class InventoryReservation extends DurableObject<Env> {
  private inventory: InventoryRepository;

  private readonly binding: D1Database;
  private readonly legacyTenantId: string;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.binding = env.DB;
    this.legacyTenantId = env.LEGACY_INVENTORY_TENANT_ID ?? DEFAULT_LEGACY_INVENTORY_TENANT_ID;
    this.inventory = new D1DoInventoryRepository(
      env.DB,
      ctx.storage,
      this.legacyTenantId,
      this.legacyTenantId,
    );
  }

  async fetch(request: Request): Promise<Response> {
    try {
      // 同じ企業・SKUの予約判断からD1反映までを直列化する。
      return await this.ctx.blockConcurrencyWhile(() => this.handleRequest(request));
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private async handleRequest(request: Request): Promise<Response> {
    const tenantId = request.headers.get(INVENTORY_TENANT_HEADER) ?? this.legacyTenantId;
    // DO名だけに依存せず初回の企業を記録し、後続要求による別企業への使い回しを拒否する。
    const bound = await this.ctx.storage.get<string>(INVENTORY_TENANT_STORAGE_KEY);
    if (bound && bound !== tenantId) {
      throw new InvalidReservationTransitionError("別企業の在庫予約にはアクセスできません");
    }

    if (!bound) {
      await this.ctx.storage.put(INVENTORY_TENANT_STORAGE_KEY, tenantId);
    }

    this.inventory = new D1DoInventoryRepository(
      this.binding,
      this.ctx.storage,
      tenantId,
      this.legacyTenantId,
    );
    const url = new URL(request.url);

    const operation = inventoryOperation(request.method, url.pathname);
    if (operation) {
      return this[operation](request, url);
    }

    return Response.json({ error: "在庫APIが見つかりません" }, { status: 404 });
  }

  private async readInventory(request: Request, url: URL): Promise<Response> {
    const sku = url.searchParams.get("sku") ?? (await this.ctx.storage.get<string>("sku"));
    if (!sku) {
      return Response.json({ error: "在庫のSKUを指定してください" }, { status: 400 });
    }

    const item = await this.load(sku, url.searchParams.get("allowMissing") === "true");
    return Response.json(url.pathname === "/snapshot" ? item.toSnapshot() : this.snapshot(item));
  }

  private async changeStock(request: Request, _url: URL): Promise<Response> {
    return changeStock(request, this.inventory, async (sku) => {
      const current = await this.load(sku, true);
      await this.bindSku(sku);
      return current;
    });
  }

  private async adjustInventory(request: Request, _url: URL): Promise<Response> {
    const tenantId = request.headers.get(INVENTORY_TENANT_HEADER) ?? this.legacyTenantId;
    return adjustStock(
      request,
      tenantId,
      this.inventory,
      new D1StockAdjustmentRepository(this.binding),
      async (sku) => {
        await this.bindSku(sku);
        return this.load(sku, true);
      },
    );
  }

  private async createReservation(request: Request, _url: URL): Promise<Response> {
    const input = reservationSchema.parse(await request.json());
    return this.reserve(input);
  }

  private async commitReservation(request: Request, url: URL): Promise<Response> {
    const orderId = decodeURIComponent(
      url.pathname.slice("/reservations/".length, -"/commit".length),
    );
    const sku = url.searchParams.get("sku") ?? (await this.ctx.storage.get<string>("sku"));
    if (!sku) {
      return Response.json({ error: "在庫のSKUを指定してください" }, { status: 400 });
    }

    try {
      const item = await this.commit(sku, orderId);
      return Response.json(this.snapshot(item));
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private async cancelAllocation(request: Request, url: URL): Promise<Response> {
    const orderId = decodeURIComponent(
      url.pathname.slice("/allocations/".length, -"/cancel".length),
    );
    const sku = url.searchParams.get("sku");
    if (!sku || !orderId) {
      return Response.json({ error: "SKUと予約IDを指定してください" }, { status: 400 });
    }

    await this.bindSku(sku);
    // 先に取消を永続化し、遅延・再配送された確定処理で在庫割当を復活させない。
    await this.inventory.markCancelled(orderId);
    const allocation = await this.inventory.findAllocation({ orderId, sku });
    if (allocation?.status === "committed") {
      const restored = allocation.restoreStock();
      await this.inventory.restoreAllocation(restored, new Date().toISOString());
    } else if (!allocation) {
      await this.release(sku, orderId);
    }

    await this.inventory.removeReservation(orderId);
    return Response.json(this.snapshot(await this.load(sku)));
  }

  private async releaseReservation(request: Request, url: URL): Promise<Response> {
    const orderId = decodeURIComponent(url.pathname.slice("/reservations/".length));
    const sku = url.searchParams.get("sku") ?? (await this.ctx.storage.get<string>("sku"));
    if (!sku) {
      return Response.json({ error: "在庫のSKUを指定してください" }, { status: 400 });
    }

    const item = await this.release(sku, orderId);
    return Response.json(this.snapshot(item));
  }

  private async reserve(input: Reservation): Promise<Response> {
    try {
      if (await this.inventory.hasEndedReservation(input.orderId)) {
        throw new InvalidReservationTransitionError("終了した在庫予約は再利用できません");
      }

      await this.bindSku(input.sku);
      const current = await this.load(input.sku);
      const item = current.reserve({
        orderId: input.orderId,
        quantity: ReservationQuantity.create(input.quantity),
        now: new Date().toISOString(),
        eventId: crypto.randomUUID(),
      });
      if (item !== current) {
        await this.inventory.save(item);
      }

      return Response.json(this.snapshot(item), { status: item === current ? 200 : 201 });
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private async release(sku: string, orderId: string): Promise<InventoryItem> {
    if (await this.inventory.isAllocationCommitted({ orderId, sku })) {
      throw new InvalidReservationTransitionError("確定した在庫予約は解放できません");
    }

    const current = await this.load(sku);
    const reservation = current.findReservation(orderId);
    const item = reservation
      ? current.release({
          reservation,
          now: new Date().toISOString(),
          eventId: crypto.randomUUID(),
        })
      : current;
    if (reservation) {
      await this.inventory.save(item);
    } else {
      await this.inventory.endReservation(orderId);
    }

    return item;
  }

  private async commit(sku: string, orderId: string): Promise<InventoryItem> {
    if (await this.inventory.hasEndedReservation(orderId)) {
      return this.load(sku);
    }

    if (await this.inventory.isAllocationCommitted({ orderId, sku })) {
      await this.inventory.removeReservation(orderId);
      return this.load(sku);
    }

    const current = await this.load(sku);
    const reservation = current.findReservation(orderId);
    if (!reservation) {
      throw new InventoryNotFoundError("在庫予約が見つかりません");
    }

    const committedAt = new Date().toISOString();
    const item = current.commitReservation({
      reservation,
      now: committedAt,
      eventId: crypto.randomUUID(),
    });

    await this.inventory.save(item);
    return item;
  }

  private async load(sku: string, allowMissing = false): Promise<InventoryItem> {
    const item = await this.inventory.find(sku, allowMissing);
    if (!item) {
      throw new InventoryNotFoundError("対象の在庫が見つかりません");
    }

    return item;
  }

  private async bindSku(sku: string): Promise<void> {
    const boundSku = await this.ctx.storage.get<string>("sku");
    if (boundSku && boundSku !== sku) {
      throw new InvalidInventoryError("この在庫予約は別のSKUに紐付いています");
    }

    await this.ctx.storage.put("sku", sku);
  }

  private snapshot(item: InventoryItem) {
    return {
      sku: item.sku,
      stock: item.onHand,
      reserved: item.reserved,
      available: item.available,
      reservations: Object.fromEntries(
        item.reservations.map((reservation) => [reservation.orderId, reservation.quantity]),
      ),
    };
  }

  private errorResponse(error: unknown): Response {
    if (error instanceof InventoryNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof InsufficientStockError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof InvalidReservationTransitionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    if (
      error instanceof InvalidInventoryError ||
      error instanceof InvalidReservationError ||
      error instanceof InvalidValueObjectError
    ) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof SyntaxError || error instanceof URIError || error instanceof ZodError) {
      return Response.json({ error: "リクエストの形式が不正です" }, { status: 400 });
    }

    logEvent("error", inventoryFailed);
    return Response.json({ error: "在庫の処理に失敗しました" }, { status: 500 });
  }
}
