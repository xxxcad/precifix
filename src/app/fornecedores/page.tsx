import { SuppliersPage } from "@/components/entity-pages";
import { loadSuppliers } from "@/lib/data/catalog";
export default async function Page() { return <SuppliersPage suppliers={await loadSuppliers()} />; }
