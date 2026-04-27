"use client";

import * as React from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Card } from "./card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Checkbox } from "./checkbox";
import { Skeleton } from "./skeleton";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

export type SortDir = "asc" | "desc";

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  /** When set, the header is a sort button using this key. */
  sortKey?: string;
  /** Width / class hooks on the <th>. */
  headerClassName?: string;
  cellClassName?: string;
  /** Render the cell. */
  cell: (row: T) => React.ReactNode;
  /** Hide on small screens (table only). */
  hideBelow?: "sm" | "md" | "lg";
  /** Stops row click when interacting with the cell. */
  stopPropagation?: boolean;
  align?: "left" | "right" | "center";
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  data: T[] | undefined;
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  /** Number of skeleton rows to show while loading. */
  skeletonRows?: number;
  /** Selection — pass to enable checkbox column. */
  selection?: {
    selectedIds: Set<string>;
    onChange: (next: Set<string>) => void;
  };
  /** Sorting state. */
  sort?: {
    sortBy: string;
    sortDir: SortDir;
    onSortChange: (sortBy: string, sortDir: SortDir) => void;
  };
  /** Click handler for whole row. */
  onRowClick?: (row: T) => void;
  /** Custom mobile card renderer. If omitted, the table renders on all sizes. */
  renderMobileCard?: (row: T) => React.ReactNode;
  /** Empty state rendered when data is loaded but empty. */
  empty?: React.ReactNode;
  pagination?: DataTablePagination;
  className?: string;
  /** Wrap in a Card (default true). */
  bordered?: boolean;
}

function hideClass(hideBelow?: "sm" | "md" | "lg") {
  if (!hideBelow) return "";
  if (hideBelow === "sm") return "hidden sm:table-cell";
  if (hideBelow === "md") return "hidden md:table-cell";
  return "hidden lg:table-cell";
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  loading,
  skeletonRows = 8,
  selection,
  sort,
  onRowClick,
  renderMobileCard,
  empty,
  pagination,
  className,
  bordered = true,
}: DataTableProps<T>) {
  const items = data ?? [];
  const totalCols = columns.length + (selection ? 1 : 0);

  const allSelected =
    selection && items.length > 0 && items.every((r) => selection.selectedIds.has(getRowId(r)));

  function toggleAll() {
    if (!selection) return;
    if (allSelected) {
      selection.onChange(new Set());
    } else {
      selection.onChange(new Set(items.map(getRowId)));
    }
  }

  function toggleRow(id: string) {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  }

  function handleSort(col: DataTableColumn<T>) {
    if (!sort || !col.sortKey) return;
    if (sort.sortBy === col.sortKey) {
      sort.onSortChange(col.sortKey, sort.sortDir === "asc" ? "desc" : "asc");
    } else {
      sort.onSortChange(col.sortKey, "desc");
    }
  }

  const tableEl = (
    <Table>
      <TableHeader>
        <TableRow>
          {selection ? (
            <TableHead className="w-10">
              <Checkbox checked={allSelected ?? false} onCheckedChange={toggleAll} />
            </TableHead>
          ) : null}
          {columns.map((col) => {
            const sortable = !!(sort && col.sortKey);
            const active = sortable && sort!.sortBy === col.sortKey;
            return (
              <TableHead
                key={col.id}
                className={cn(
                  hideClass(col.hideBelow),
                  col.headerClassName,
                  sortable && "cursor-pointer select-none",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                )}
                onClick={sortable ? () => handleSort(col) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {sortable ? (
                    <ArrowUpDown
                      className={cn(
                        "h-3 w-3 transition-opacity",
                        active ? "opacity-100" : "opacity-30",
                      )}
                    />
                  ) : null}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: skeletonRows }).map((_, i) => (
            <TableRow key={`sk-${i}`}>
              {selection ? (
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
              ) : null}
              {columns.map((col) => (
                <TableCell key={col.id} className={cn(hideClass(col.hideBelow), col.cellClassName)}>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={totalCols} className="h-40">
              {empty ?? <EmptyState title="Geen resultaten" />}
            </TableCell>
          </TableRow>
        ) : (
          items.map((row) => {
            const id = getRowId(row);
            return (
              <TableRow
                key={id}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {selection ? (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.selectedIds.has(id)}
                      onCheckedChange={() => toggleRow(id)}
                    />
                  </TableCell>
                ) : null}
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      hideClass(col.hideBelow),
                      col.cellClassName,
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                    )}
                    onClick={col.stopPropagation ? (e) => e.stopPropagation() : undefined}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  const mobileEl = renderMobileCard ? (
    <div className="grid gap-2.5 p-3 md:hidden">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))
      ) : items.length === 0 ? (
        empty ?? <EmptyState title="Geen resultaten" size="sm" />
      ) : (
        items.map((row) => (
          <React.Fragment key={getRowId(row)}>{renderMobileCard(row)}</React.Fragment>
        ))
      )}
    </div>
  ) : null;

  const paginationEl =
    pagination && pagination.totalPages > 1 ? (
      <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
        <p className="text-muted-foreground">
          {(pagination.page - 1) * pagination.pageSize + 1}
          &ndash;
          {Math.min(pagination.page * pagination.pageSize, pagination.total)} van {pagination.total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ) : null;

  const inner = (
    <>
      {mobileEl}
      <div className={cn(renderMobileCard ? "hidden md:block" : "block")}>{tableEl}</div>
      {paginationEl}
    </>
  );

  if (!bordered) return <div className={className}>{inner}</div>;
  return <Card className={cn("overflow-hidden", className)}>{inner}</Card>;
}
