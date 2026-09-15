import type { ListingType, MarketplaceKey, RegionKey } from "./types";

export type LatestSavedPriceMap = Readonly<Record<string,string>>;
export const latestSavedPriceKey = (productId:string,marketplace:MarketplaceKey,listingType:ListingType,region:RegionKey) => `${productId}:${marketplace}:${listingType}:${region}`;
