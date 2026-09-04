"use client";

import { deleteSupplier } from "@/app/cadastros/actions";

export function SupplierDeletePanel({ supplierId, supplierName, isAdmin }: { supplierId: string; supplierName: string; isAdmin: boolean }) {
  if (!isAdmin) return null;
  return <form action={deleteSupplier} className="danger-zone" onSubmit={(event) => { if (!window.confirm(`Excluir definitivamente o fornecedor ${supplierName}? Esta ação não pode ser desfeita.`)) event.preventDefault(); }}><input type="hidden" name="id" value={supplierId} /><div><strong>Excluir fornecedor</strong><p>Disponível somente quando não existem produtos vinculados.</p></div><button className="danger-button" type="submit">Excluir fornecedor</button></form>;
}
