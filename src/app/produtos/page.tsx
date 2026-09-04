import { ProductsPage } from "@/components/entity-pages";
import { loadCatalogProducts } from "@/lib/data/catalog";
export default async function Page() { const catalog = await loadCatalogProducts({ includeInactive: true }); return <ProductsPage products={catalog.products} />; }
