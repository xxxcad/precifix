import { describe, expect, it } from "vitest";
import { latestSavedPriceKey } from "./catalog";

describe("latestSavedPriceKey", () => {
  it("separa produto, canal, modalidade e região", () => {
    expect(latestSavedPriceKey("produto-1","MERCADO_LIVRE","PREMIUM","SUL_SUDESTE")).toBe("produto-1:MERCADO_LIVRE:PREMIUM:SUL_SUDESTE");
  });
  it("não mistura Clássico e Premium", () => {
    expect(latestSavedPriceKey("produto-1","MERCADO_LIVRE","CLASSICO","SP")).not.toBe(latestSavedPriceKey("produto-1","MERCADO_LIVRE","PREMIUM","SP"));
  });
});
