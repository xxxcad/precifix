"use server";

import { z } from "zod";
import { loadProductPricingHistoryPage, loadSavedPricingDetail } from "@/lib/data/saved-pricing-analytics";

export async function loadPricingDetailAction(id: string) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return null;
  return loadSavedPricingDetail(parsed.data);
}

export async function loadSupplierProductHistoryAction(productId: string, page = 1) {
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return null;
  return loadProductPricingHistoryPage(parsed.data, { scenario: "ALL", region: "ALL", creatorId: "", period: "ALL", dateFrom: "", dateTo: "", sort: "date", direction: "desc", page: Math.max(1, page) });
}
