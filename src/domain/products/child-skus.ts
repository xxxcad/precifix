export type ChildSku = Readonly<{ id: string; sku: string; description: string | null }>;

export const normalizeSku = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export function findMatchingChildSku(children: ReadonlyArray<ChildSku> | undefined, query: string) {
  const term = normalizeSku(query);
  if (!term) return undefined;
  return children?.find((child) => normalizeSku(`${child.sku} ${child.description ?? ""}`).includes(term));
}

export function hasChildSkuDuplicates(parentSku: string, children: ReadonlyArray<Pick<ChildSku, "sku">>) {
  const parent = normalizeSku(parentSku);
  const normalized = children.map((child) => normalizeSku(child.sku)).filter(Boolean);
  return new Set(normalized).size !== normalized.length || normalized.includes(parent);
}

export function parseBulkChildSkus(value: string) {
  return value.split(/[\n;,]+/).map((item) => item.trim()).filter(Boolean);
}
