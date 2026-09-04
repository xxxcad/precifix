import { publishMercadoLivreShippingRule } from "@/app/marketplaces/actions";
import type { MarketplaceShippingRule } from "@/domain/pricing/types";

export function MlShippingRuleForm({ rule, isAdmin }: { rule: MarketplaceShippingRule; isAdmin: boolean }) {
  const rateByCell = new Map(rule.rates.map((rate) => [`${rate.weightBandId}:${rate.priceBandId}`, rate.cost]));
  return <form action={publishMercadoLivreShippingRule} className="entity-form ml-shipping-editor">
    <div className="card-heading"><div><h2>Regra de frete vigente · versão {rule.version}</h2><p>O maior valor entre peso real e peso cubado define a linha; o preço de venda define a coluna.</p></div></div>
    <div className="shipping-rule-meta">
      <label><span>Fonte</span><input name="sourceUrl" type="url" defaultValue={rule.sourceUrl} required disabled={!isAdmin} /></label>
      <label><span>Vigência</span><input name="effectiveFrom" type="date" defaultValue={rule.effectiveFrom.slice(0, 10)} required disabled={!isAdmin} /></label>
    </div>
    <div className="shipping-matrix-scroll">
      <table className="shipping-matrix"><thead><tr><th>Peso real</th>{rule.priceBands.map((band) => <th key={band.id}><input name="shippingPriceLabel" aria-label={`Nome da faixa de preço ${band.sortOrder}`} defaultValue={band.label} required disabled={!isAdmin} /><input name="shippingPriceMax" aria-label={`Limite da faixa de preço ${band.sortOrder}`} type="number" min="0.01" step="0.01" defaultValue={band.maxPrice ?? ""} placeholder="Ou mais" disabled={!isAdmin} /></th>)}</tr></thead>
        <tbody>{rule.weightBands.map((weight) => <tr key={weight.id}><th><input name="shippingWeightLabel" aria-label={`Nome da faixa de peso ${weight.sortOrder}`} defaultValue={weight.label} required disabled={!isAdmin} /><input name="shippingWeightMax" aria-label={`Limite da faixa de peso ${weight.sortOrder}`} type="number" min="0.001" step="0.001" defaultValue={weight.maxWeightKg ?? ""} placeholder="Ou mais" disabled={!isAdmin} /></th>{rule.priceBands.map((price) => <td key={price.id}><span>R$</span><input name="shippingRateCost" aria-label={`${weight.label}, ${price.label}`} type="number" min="0" step="0.01" defaultValue={rateByCell.get(`${weight.id}:${price.id}`)} required disabled={!isAdmin} /></td>)}</tr>)}</tbody>
      </table>
    </div>
    {isAdmin && <><label><span>Motivo da nova versão</span><input name="shippingReason" minLength={5} required placeholder="Ex.: atualização da tabela oficial" /></label><div className="form-actions"><button className="primary-button" type="submit">Publicar nova versão</button></div></>}
  </form>;
}
