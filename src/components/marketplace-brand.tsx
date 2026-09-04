import Image from "next/image";
import type { MarketplaceKey } from "@/domain/pricing/types";

const assets: Record<MarketplaceKey, { src: string; alt: string }> = {
  MERCADO_LIVRE: { src: "/marketplaces/mercado-livre.svg", alt: "Mercado Livre" },
  SHOPEE: { src: "/marketplaces/shopee.svg", alt: "Shopee" },
  AMAZON: { src: "/marketplaces/amazon.svg", alt: "Amazon" },
};

export function MarketplaceBrand({ marketplace, compact = false }: { marketplace: MarketplaceKey; compact?: boolean }) {
  const asset = assets[marketplace];
  return <span className={`marketplace-brand ${compact ? "compact" : ""}`}><Image src={asset.src} alt={asset.alt} width={compact ? 24 : 32} height={compact ? 24 : 32} /></span>;
}
