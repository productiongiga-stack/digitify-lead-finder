import type { WorkspaceSavedSearch } from "@digitify/db";

export function serializeSavedSearch(row: WorkspaceSavedSearch) {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    city: row.city,
    country: row.country,
    niche: row.niche,
    pageSize: row.pageSize,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
