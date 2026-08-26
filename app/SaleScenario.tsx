"use client";
import {CheckboxGrid} from "./filters/CheckboxGrid";

type Props={
 keepPct:number;
 onKeepPct:(value:number)=>void;
 taxOn:boolean;
 onTaxOn:(value:boolean)=>void;
 taxRate:number;
 onTaxRate:(value:number)=>void;
 shipping:number;
 onShipping:(value:number)=>void;
 profitableOnly:boolean;
 onProfitableOnly:(value:boolean)=>void;
};

export default function SaleScenario({keepPct,onKeepPct,taxOn,onTaxOn,taxRate,onTaxRate,shipping,onShipping,profitableOnly,onProfitableOnly}:Props){
 const active=Number(keepPct!==100)+Number(taxOn)+Number(shipping>0)+Number(profitableOnly);
 const selected=[taxOn?"tax":"",profitableOnly?"profitable":""].filter(Boolean);
 return <section className={`sale-scenario ${active?"has-scenario":""}`} aria-labelledby="sale-scenario-title">
  <header><span id="sale-scenario-title">Sale scenario</span><b>{active?`${active} active`:"Default assumptions"}</b></header>
  <div className="sale-scenario-controls">
   <label className={`scenario-number ${keepPct!==100?"has-value":""}`}><span>Keep after fees</span><span className="number-control"><input aria-label="Keep after fees" type="number" min="1" max="100" value={keepPct} onChange={event=>onKeepPct(Math.min(100,Math.max(1,Number(event.target.value))))}/><b>%</b></span></label>
   <label className={`scenario-number ${shipping>0?"has-value":""}`}><span>Shipping cost</span><span className="number-control"><b>$</b><input aria-label="Shipping cost" type="number" min="0" step="0.5" value={shipping} onChange={event=>onShipping(Math.max(0,Number(event.target.value)))}/></span></label>
   <label className={`scenario-number ${taxOn?"has-value":"is-disabled"}`}><span>Tax rate</span><span className="number-control"><input aria-label="Tax rate" type="number" min="0" max="20" step="0.1" disabled={!taxOn} value={taxRate} onChange={event=>onTaxRate(Math.max(0,Number(event.target.value)))}/><b>%</b></span></label>
   <CheckboxGrid className="movement-filters scenario-checks" options={[{key:"tax",label:"Include sales tax"},{key:"profitable",label:"Profitable products only"}]} selected={selected} onToggle={key=>key==="tax"?onTaxOn(!taxOn):onProfitableOnly(!profitableOnly)}/>
  </div>
 </section>;
}
