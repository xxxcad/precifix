"use client";
import { useState } from "react";
import type { Route } from "next";
import type { RepricingItem, SortDirection } from "@/lib/data/catalog";
import { updateQueueItems } from "@/app/reprecificacao/actions";
import { SortableColumn } from "./sortable-column";

export function RepricingPendingTable({ items, sort, direction, links }: { items: RepricingItem[]; sort: string; direction: SortDirection; links: Record<string, Route> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = items.length > 0 && selected.length === items.length;
  return (
    <form action={updateQueueItems}>
      <div className="bulk-actions">
        <label>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) =>
              setSelected(
                event.target.checked ? items.map((item) => item.id) : [],
              )
            }
          />
          Selecionar todos
        </label>
        <button
          className="secondary-button"
          type="submit"
          disabled={!selected.length}
        >
          Marcar selecionados como feitos ({selected.length})
        </button>
      </div>
      <div className="data-table repricing-table">
        <div className="table-row queue-list queue-select table-head">
          <span />
          <SortableColumn label="Produto" active={sort === "product"} direction={direction} href={links.product} />
          <SortableColumn label="Canal" active={sort === "channel"} direction={direction} href={links.channel} />
          <SortableColumn label="Tipo" active={sort === "type"} direction={direction} href={links.type} />
          <SortableColumn label="Motivo" active={sort === "reason"} direction={direction} href={links.reason} />
          <SortableColumn label="Alterado" active={sort === "date"} direction={direction} href={links.date} />
          <span>Ação</span>
        </div>
        {items.map((item) => (
          <div className="table-row queue-list queue-select" key={item.id}>
            <span>
              <input
                type="checkbox"
                name="ids"
                value={item.id}
                checked={selected.includes(item.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id),
                  )
                }
              />
            </span>
            <span className="queue-product">
              <strong>{item.sku}</strong>
              <small>{item.productName}</small>
            </span>
            <span className="queue-channel">{item.marketplace}</span>
            <span><em className="repricing-type">{item.typeLabel}</em></span>
            <span className="queue-reason">{item.reason}</span>
            <span>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
            <span>
              <button
                className="text-button"
                type="submit"
                name="singleId"
                value={item.id}
              >
                Marcar como feita
              </button>
            </span>
          </div>
        ))}
      </div>
    </form>
  );
}
