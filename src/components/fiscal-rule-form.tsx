import Link from "next/link";
import type { Route } from "next";

export type FiscalRuleValues = {
  id?: string; code: string; name: string; has_st: boolean; active: boolean;
  output_icms_sp_rate: number; output_icms_south_southeast_rate: number; output_icms_north_northeast_rate: number;
};

const rateFields = [
  ["outputIcmsSpRate", "ICMS saída SP", "output_icms_sp_rate"],
  ["outputIcmsSouthSoutheastRate", "ICMS saída Sul/Sudeste", "output_icms_south_southeast_rate"],
  ["outputIcmsNorthNortheastRate", "ICMS saída Norte/Nordeste", "output_icms_north_northeast_rate"],
] as const;

export function FiscalRuleForm({ action, rule, error }: { action: (formData: FormData) => void | Promise<void>; rule?: FiscalRuleValues; error?: string }) {
  return <section className="wide-card form-card">{error && <div className="form-error">{error}</div>}<form action={action} className="entity-form form-grid">
    {rule?.id && <input type="hidden" name="id" value={rule.id} />}
    <label><span>Código</span><input name="code" defaultValue={rule?.code ?? ""} placeholder="EX.: NACIONAL_ESPECIAL" required /></label>
    <label><span>Nome</span><input name="name" defaultValue={rule?.name ?? ""} required /></label>
    <label><span>Substituição tributária (ST)</span><select name="hasSt" defaultValue={String(rule?.has_st ?? false)}><option value="false">Não</option><option value="true">Sim</option></select></label>
    <label><span>Status</span><select name="active" defaultValue={String(rule?.active ?? true)}><option value="true">Ativa</option><option value="false">Inativa</option></select></label>
    <div className="form-section-title full"><strong>ICMS de saída</strong><small>Somente estes valores pertencem à regra fiscal. Informe 18 para 18%.</small></div>
    {rateFields.map(([name, label, key]) => <label key={name}><span>{label} (%)</span><input name={name} type="number" min="0" max="100" step="0.0001" defaultValue={Number(rule?.[key] ?? 0) * 100} required /></label>)}
    <div className="form-actions full"><Link className="secondary-button" href={"/regras-fiscais" as Route}>Cancelar</Link><button className="primary-button" type="submit">Salvar regra fiscal</button></div>
  </form></section>;
}
