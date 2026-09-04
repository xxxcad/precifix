import Link from "next/link";
import { notFound } from "next/navigation";
import { updateAmazonRateForAll, updateMarketplace } from "@/app/marketplaces/actions";
import { MarketplaceBrand } from "@/components/marketplace-brand";
import { AmazonShippingRuleForm } from "@/components/amazon-shipping-rule-form";
import { MlShippingRuleForm } from "@/components/ml-shipping-rule-form";
import { PageHeader } from "@/components/page-header";
import type { MarketplaceKey } from "@/domain/pricing/types";
import { loadAmazonShippingRule, loadMercadoLivreShippingRule } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ code: slug }, messages] = await Promise.all([params, searchParams]);
  const code = slug.toUpperCase() as MarketplaceKey;
  if (!( ["MERCADO_LIVRE", "SHOPEE", "AMAZON"] as string[]).includes(code)) notFound();
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  const [{ data: marketplace }, { data: profile }] = await Promise.all([
    supabase.from("marketplaces").select("*").eq("code", code).single(),
    userId ? supabase.from("profiles").select("role,active").eq("id", userId).single() : Promise.resolve({ data: null }),
  ]);
  if (!marketplace) notFound();
  const isAdmin = Boolean(profile?.active && profile.role === "admin");
  const [{ data: ruleSets }, shippingRule] = await Promise.all([
    code === "SHOPEE" ? supabase.from("marketplace_fee_rule_sets").select("*").eq("marketplace_id", marketplace.id).eq("status", "PUBLISHED").order("listing_type") : Promise.resolve({ data: [] }),
    code === "MERCADO_LIVRE" ? loadMercadoLivreShippingRule() : code === "AMAZON" ? loadAmazonShippingRule() : Promise.resolve(null),
  ]);
  const ids = (ruleSets ?? []).map((rule) => rule.id);
  const { data: bands } = ids.length ? await supabase.from("marketplace_fee_bands").select("*").in("rule_set_id", ids).order("sort_order") : { data: [] };

  return <><PageHeader eyebrow="Marketplace" title={`${isAdmin ? "Editar" : "Consultar"} ${marketplace.name}`} />
    <section className="wide-card form-card marketplace-edit">
      <div className="marketplace-edit-brand"><MarketplaceBrand marketplace={code} /><strong>{marketplace.name}</strong></div>
      {messages.error && <div className="form-error">{messages.error}</div>}{messages.success && <div className="notice-card"><div><strong>{messages.success}</strong></div></div>}
      {!isAdmin && <div className="notice-card"><div><strong>Acesso somente para consulta</strong><p>Apenas administradores podem alterar regras de marketplace.</p></div></div>}
      <form action={updateMarketplace} className="entity-form"><input type="hidden" name="id" value={marketplace.id} /><input type="hidden" name="code" value={slug} />
        <label><span>Nome</span><input name="name" defaultValue={marketplace.name} required disabled={!isAdmin} /></label>
        <label><span>Tratamento do frete</span><select name="shippingMode" defaultValue={marketplace.shipping_mode} disabled={!isAdmin}><option value="NONE">Sem frete</option><option value="OPTIONAL">Opcional</option><option value="REQUIRED">Obrigatório</option></select></label>
        {code !== "SHOPEE" && <div className="notice-card"><div><strong>Comissões específicas por produto</strong><p>{code === "MERCADO_LIVRE" ? "As taxas Clássico e Premium variam por produto e são preenchidas no cadastro do item." : "A tarifa Amazon varia por produto e é preenchida no cadastro do item."}</p></div></div>}
        {(ruleSets ?? []).map((set) => <div className="fee-editor" key={set.id}><h2>Faixas tarifárias vigentes</h2><p>Edite os limites em reais. A última faixa deve permanecer sem limite máximo.</p><input type="hidden" name="ruleSetId" value={set.id} />{(bands ?? []).filter((band) => band.rule_set_id === set.id).map((band) => <div className="fee-editor-row" key={band.id}><input type="hidden" name="bandId" value={band.id} /><input type="hidden" name="bandRuleSetId" value={set.id} /><span>{band.label}</span><label><span>De (R$)</span><input name="minPrice" type="number" min="0" step="0.01" defaultValue={band.min_price} disabled={!isAdmin} required /></label><label><span>Até (R$)</span><input name="maxPrice" type="number" min="0.01" step="0.01" defaultValue={band.max_price ?? ""} placeholder="Ou mais" disabled={!isAdmin} /></label><label><span>Comissão decimal</span><input name="percentageRate" type="number" min="0" max="1" step="0.00000001" defaultValue={band.percentage_rate} disabled={!isAdmin} required /></label><label><span>Tarifa fixa</span><input name="fixedFee" type="number" min="0" step="0.01" defaultValue={band.fixed_fee} disabled={!isAdmin} required /></label></div>)}</div>)}
        {isAdmin && <><label><span>Motivo da alteração</span><input name="reason" required minLength={5} placeholder="Ex.: atualização de setembro" /></label><div className="form-actions"><Link className="secondary-button" href="/marketplaces">Cancelar</Link><button className="primary-button" type="submit">Salvar configurações</button></div></>}
      </form>
      {code === "AMAZON" && isAdmin && <form action={updateAmazonRateForAll} className="entity-form fee-editor"><input type="hidden" name="marketplaceId" value={marketplace.id} /><h2>Atualização em massa da Amazon</h2><p>Substitui a tarifa Amazon de todos os produtos ativos e envia os itens para reprecificação.</p><label><span>Nova tarifa Amazon (%)</span><input name="amazonRate" type="number" min="0" max="100" step="0.0001" required /></label><label><span>Motivo da atualização</span><input name="reason" required minLength={5} /></label><div className="form-actions"><button className="primary-button" type="submit">Atualizar todos os produtos</button></div></form>}
    </section>
    {shippingRule && <section className="wide-card form-card marketplace-edit">{code === "AMAZON" ? <AmazonShippingRuleForm rule={shippingRule} isAdmin={isAdmin} /> : <MlShippingRuleForm rule={shippingRule} isAdmin={isAdmin} />}</section>}
  </>;
}
