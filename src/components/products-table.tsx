"use client";

import Link from "next/link";
import { CheckCircle2, Edit3, History, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import type { DemoProduct } from "@/data/demo-data";
import { formatMoney } from "@/lib/format";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export function ProductsTable({ products }: { products: DemoProduct[] }) {
  const [search, setSearch] = useState(""); const [supplier, setSupplier] = useState("");
  const suppliers = useMemo(() => Array.from(new Set(products.map((product) => product.supplierName))).sort((a, b) => a.localeCompare(b, "pt-BR")), [products]);
  const filtered = useMemo(() => { const term = normalize(search); return products.filter((product) => (!supplier || product.supplierName === supplier) && (!term || normalize(`${product.sku} ${product.manufacturerCode} ${product.productName}`).includes(term))); }, [products, search, supplier]);
  return <><div className="toolbar"><input aria-label="Pesquisar produtos" placeholder="Buscar por SKU, código do fornecedor ou nome" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filtrar fornecedor" value={supplier} onChange={(event) => setSupplier(event.target.value)}><option value="">Todos os fornecedores</option>{suppliers.map((name) => <option value={name} key={name}>{name}</option>)}</select></div><div className="filter-result">{filtered.length} de {products.length} produto{products.length === 1 ? "" : "s"}</div><div className="data-table"><div className="table-row product-list table-head"><span>Produto</span><span>Fornecedor</span><span>Regra fiscal</span><span>Custo</span><span>Status</span><span>Ações</span></div>{filtered.map((product) => <div className="table-row product-list" key={product.productId}><span><strong>{product.sku}</strong><small title={product.productName}>{product.productName} · {product.manufacturerCode}</small>{product.hasFixedPrice && product.fixedPrice && <em className="fixed-price-badge" title={`Preço tabelado indicado: ${formatMoney(product.fixedPrice)}`}>Preço tabelado · {formatMoney(product.fixedPrice)}</em>}</span><span>{product.supplierName}</span><span>{product.fiscalRule.replaceAll("_", " ")}</span><span>{formatMoney(product.cost)}</span><span className={product.active ? "active-state" : "extinct-state"}>{product.active ? <><CheckCircle2 size={15} />Ativo</> : "Extinto"}</span><span className="row-actions"><Link href={`/produtos/${product.productId}/historico`} title="Histórico de custo"><History size={16} /></Link><Link href={`/produtos/${product.productId}/editar`} title="Editar produto"><Edit3 size={16} /></Link></span></div>)}{filtered.length === 0 && <div className="empty-filter"><SearchX size={22} /><strong>Nenhum produto encontrado</strong><span>Revise a pesquisa ou o fornecedor selecionado.</span></div>}</div></>;
}
