import { describe, expect, it } from "vitest";
import { findMatchingChildSku, hasChildSkuDuplicates, normalizeSku, parseBulkChildSkus } from "./child-skus";

describe("SKUs filhos", () => {
  it("normaliza espaços e caixa", () => expect(normalizeSku("  ABC-01 ")).toBe("abc-01"));
  it("encontra por código ou descrição", () => {
    const children = [{ id: "1", sku: "PAI-AZ", description: "Azul" }];
    expect(findMatchingChildSku(children, "pai-az")?.sku).toBe("PAI-AZ");
    expect(findMatchingChildSku(children, "azul")?.sku).toBe("PAI-AZ");
  });
  it("detecta filho repetido ou igual ao pai", () => {
    expect(hasChildSkuDuplicates("PAI", [{ sku: "filho" }, { sku: " FILHO " }])).toBe(true);
    expect(hasChildSkuDuplicates("PAI", [{ sku: " pai " }])).toBe(true);
    expect(hasChildSkuDuplicates("PAI", [{ sku: "filho" }])).toBe(false);
  });
  it("aceita colagem por linha, vírgula ou ponto e vírgula", () => {
    expect(parseBulkChildSkus("A\nB, C;D")).toEqual(["A", "B", "C", "D"]);
  });
});
