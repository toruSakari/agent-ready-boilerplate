/** HTTP契約を業務操作へ変換する。SKU・企業の検証は各操作に残す。 */
export function inventoryOperation(method: string, path: string) {
  if (method === "GET") {
    return "readInventory";
  }

  if (method === "DELETE") {
    return path.startsWith("/reservations/") ? "releaseReservation" : null;
  }

  if (method !== "POST") {
    return null;
  }

  if (path === "/adjustments") {
    return "adjustInventory";
  }

  if (path === "/stock") {
    return "changeStock";
  }

  if (path === "/reservations") {
    return "createReservation";
  }

  return reservationAction(path);
}

function reservationAction(path: string) {
  if (path.startsWith("/reservations/") && path.endsWith("/commit")) {
    return "commitReservation";
  }

  if (path.startsWith("/allocations/") && path.endsWith("/cancel")) {
    return "cancelAllocation";
  }

  return null;
}
