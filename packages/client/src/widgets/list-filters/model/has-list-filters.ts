export function hasListFilters(filters: object) {
  return Object.values(filters).some(
    (value) => value !== undefined && value !== "" && value !== "newest",
  );
}
