import { MarketplacesPage } from "@/components/entity-pages";
import { loadMarketplaceRuleCards } from "@/lib/data/catalog";
export default async function Page() { return <MarketplacesPage rules={await loadMarketplaceRuleCards()} />; }
