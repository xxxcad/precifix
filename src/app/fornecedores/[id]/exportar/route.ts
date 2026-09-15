import { NextResponse } from "next/server";
import { loadSupplierAnalytics, type AnalyticsRegion, type ScenarioKey } from "@/lib/data/supplier-analytics";
import { createClient } from "@/lib/supabase/server";

const keys:ScenarioKey[]=["ML_CLASSICO","ML_PREMIUM","SHOPEE","AMAZON"];
const csv=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params, url=new URL(request.url), rawRegion=url.searchParams.get("region")??"SP",region=(['SP','SUL_SUDESTE','NORTE_NORDESTE'].includes(rawRegion)?rawRegion:"SP") as AnalyticsRegion,includeInactive=url.searchParams.get("inactive")==="1";
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Não autorizado"},{status:401});
 const [{data:supplier},analytics]=await Promise.all([supabase.from("suppliers").select("name").eq("id",id).maybeSingle(),loadSupplierAnalytics(id,region)]); if(!supplier||!analytics)return NextResponse.json({error:"Fornecedor não encontrado"},{status:404});
 const header=["SKU pai","SKUs filhos","Produto","Status","Custo",...keys.flatMap(key=>[`${key} preço`,`${key} margem R$`,`${key} margem %`,`${key} frete`,`${key} data`]),"Reprecificação pendente"];
 const rows=analytics.products.filter(item=>includeInactive||item.active).map(item=>[item.sku,item.childSkus.join(", "),item.name,item.active?"Ativo":"Extinto",item.cost,...keys.flatMap(key=>{const metric=item.scenarios[key];return metric?[metric.price,metric.marginValue,metric.marginPercent,metric.shipping,metric.createdAt]:["","","","",""]}),item.pending?"Sim":"Não"]);
 const body="\uFEFF"+[header,...rows].map(row=>row.map(csv).join(";")).join("\r\n");
 return new NextResponse(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="fornecedor-${supplier.name.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-${region}.csv"`}});
}
