import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type AnalyticsRegion = "SP" | "SUL_SUDESTE" | "NORTE_NORDESTE";
export type ScenarioKey = "ML_CLASSICO" | "ML_PREMIUM" | "SHOPEE" | "AMAZON";
export type ScenarioMetric = { price:number; shipping:number; marginValue:number; marginPercent:number; createdAt:string; commission:number; fixedFee:number; rebate:number };
export type SupplierProductAnalytics = { id:string; sku:string; childSkus:string[]; name:string; manufacturerCode:string|null; active:boolean; cost:number; pending:boolean; scenarios:Partial<Record<ScenarioKey,ScenarioMetric>> };
export type SupplierAnalytics = { products:SupplierProductAnalytics[]; averages:Partial<Record<ScenarioKey,{value:number;percent:number;count:number}>>; overall:{value:number;percent:number;count:number}; activeProducts:number; pricedProducts:number; pendingProducts:number; topValue:SupplierProductAnalytics|null; topPercent:SupplierProductAnalytics|null; lowest:SupplierProductAnalytics|null };
export type SupplierCardSummary = { averageMarginValue:number|null; averageMarginPercent:number|null; pricedProducts:number };

const scenario = (code:string, listing:string):ScenarioKey|undefined => code === "MERCADO_LIVRE" ? (listing === "PREMIUM" ? "ML_PREMIUM" : "ML_CLASSICO") : code === "SHOPEE" ? "SHOPEE" : code === "AMAZON" ? "AMAZON" : undefined;
const obj = (value:Json):Record<string,unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};

export async function loadSupplierCardSummaries(region:AnalyticsRegion="SP"):Promise<Map<string,SupplierCardSummary>>{
  const supabase=await createClient();
  const [{data:products},{data:markets}]=await Promise.all([supabase.from("products").select("id,supplier_id").eq("active",true),supabase.from("marketplaces").select("id,code")]);
  const productIds=(products??[]).map(product=>product.id); if(!productIds.length)return new Map();
  const rows:Array<{product_id:string;marketplace_id:string;listing_type:string;results:Json;created_at:string}>=[];
  for(let from=0;;from+=1000){const page=await supabase.from("pricing_calculations").select("product_id,marketplace_id,listing_type,results,created_at").in("product_id",productIds).order("created_at",{ascending:false}).range(from,from+999);rows.push(...(page.data??[]));if((page.data?.length??0)<1000)break;}
  const marketMap=new Map((markets??[]).map(m=>[m.id,m.code])),supplierByProduct=new Map((products??[]).map(p=>[p.id,p.supplier_id])),latest=new Set<string>(),values=new Map<string,Array<{value:number;percent:number;productId:string}>>();
  for(const row of rows){const key=scenario(marketMap.get(row.marketplace_id)??"",row.listing_type);if(!key)continue;const unique=`${row.product_id}:${key}`;if(latest.has(unique))continue;latest.add(unique);const regional=obj(obj(row.results)[region] as Json),supplierId=supplierByProduct.get(row.product_id);if(!supplierId)continue;values.set(supplierId,[...(values.get(supplierId)??[]),{value:Number(regional.contributionMarginValue??0),percent:Number(regional.contributionMarginPercent??0),productId:row.product_id}]);}
  return new Map([...values].map(([supplierId,items])=>[supplierId,{averageMarginValue:items.reduce((sum,item)=>sum+item.value,0)/items.length,averageMarginPercent:items.reduce((sum,item)=>sum+item.percent,0)/items.length,pricedProducts:new Set(items.map(item=>item.productId)).size}]));
}

export async function loadSupplierAnalytics(supplierId:string, region:AnalyticsRegion):Promise<SupplierAnalytics|null> {
  const supabase = await createClient();
  const [{data:supplier},{data:products},{data:markets},{data:pending}] = await Promise.all([
    supabase.from("suppliers").select("id").eq("id",supplierId).maybeSingle(),
    supabase.from("products").select("id,sku,name,manufacturer_code,active,cost").eq("supplier_id",supplierId),
    supabase.from("marketplaces").select("id,code"),
    supabase.from("repricing_queue").select("product_id").in("status",["OPEN","IN_PROGRESS"]),
  ]);
  if (!supplier) return null;
  const ids=(products??[]).map(p=>p.id), calculations: Array<{product_id:string;marketplace_id:string;listing_type:string;sale_price:number;shipping_cost:number;results:Json;input_snapshot:Json;created_at:string}> = [];
  const {data:children}=ids.length ? await supabase.from("product_child_skus").select("product_id,sku").in("product_id",ids) : {data:[]};
  const childrenByProduct=new Map<string,string[]>();
  for(const child of children??[]) childrenByProduct.set(child.product_id,[...(childrenByProduct.get(child.product_id)??[]),child.sku]);
  for(let from=0; ids.length; from+=1000){ const page=await supabase.from("pricing_calculations").select("product_id,marketplace_id,listing_type,sale_price,shipping_cost,results,input_snapshot,created_at").in("product_id",ids).order("created_at",{ascending:false}).range(from,from+999); calculations.push(...(page.data??[])); if((page.data?.length??0)<1000) break; }
  const marketMap=new Map((markets??[]).map(m=>[m.id,m.code])); const pendingSet=new Set((pending??[]).map(p=>p.product_id)); const latest=new Map<string,ScenarioMetric>();
  for(const c of calculations){ const key=scenario(marketMap.get(c.marketplace_id)??"",c.listing_type); if(!key)continue; const mapKey=`${c.product_id}:${key}`; if(latest.has(mapKey))continue; const regional=obj(obj(c.results)[region] as Json); const input=obj(c.input_snapshot); latest.set(mapKey,{price:Number(c.sale_price),shipping:Number(c.shipping_cost),marginValue:Number(regional.contributionMarginValue??0),marginPercent:Number(regional.contributionMarginPercent??0),createdAt:c.created_at,commission:Number(regional.marketplacePercentageFee??0),fixedFee:Number(regional.marketplaceFixedFee??0),rebate:Number(regional.marketplaceRebate??input.marketplaceRebateValue??0)}); }
  const rows=(products??[]).map(p=>({id:p.id,sku:p.sku,childSkus:childrenByProduct.get(p.id)??[],name:p.name,manufacturerCode:p.manufacturer_code,active:p.active,cost:Number(p.cost),pending:pendingSet.has(p.id),scenarios:Object.fromEntries((["ML_CLASSICO","ML_PREMIUM","SHOPEE","AMAZON"] as ScenarioKey[]).flatMap(k=>{const v=latest.get(`${p.id}:${k}`);return v?[[k,v]]:[]}))} as SupplierProductAnalytics));
  const active=rows.filter(p=>p.active), observations=active.flatMap(p=>Object.values(p.scenarios)); const avg=(items:ScenarioMetric[])=>items.length?{value:items.reduce((a,b)=>a+b.marginValue,0)/items.length,percent:items.reduce((a,b)=>a+b.marginPercent,0)/items.length,count:items.length}:undefined;
  const averages=Object.fromEntries((["ML_CLASSICO","ML_PREMIUM","SHOPEE","AMAZON"] as ScenarioKey[]).flatMap(k=>{const v=avg(active.flatMap(p=>p.scenarios[k]?[p.scenarios[k]!]:[]));return v?[[k,v]]:[]}));
  const score=(p:SupplierProductAnalytics,field:"marginValue"|"marginPercent")=>Math.max(...Object.values(p.scenarios).map(v=>v[field]),-Infinity); const priced=active.filter(p=>Object.keys(p.scenarios).length);
  return {products:rows,averages,overall:avg(observations)??{value:0,percent:0,count:0},activeProducts:active.length,pricedProducts:priced.length,pendingProducts:active.filter(p=>p.pending).length,topValue:priced.toSorted((a,b)=>score(b,"marginValue")-score(a,"marginValue"))[0]??null,topPercent:priced.toSorted((a,b)=>score(b,"marginPercent")-score(a,"marginPercent"))[0]??null,lowest:priced.toSorted((a,b)=>score(a,"marginPercent")-score(b,"marginPercent"))[0]??null};
}
