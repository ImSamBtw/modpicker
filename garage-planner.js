(()=>{
'use strict';
const CATEGORY_ORDER={
 reliability:['Cooling','Brakes','Drivetrain','Engine','Maintenance','Suspension'],
 power:['Intake','Exhaust','Tuning','Cooling','Drivetrain'],
 handling:['Suspension','Brakes','Chassis','Wheels','Tires'],
 track:['Brakes','Suspension','Cooling','Chassis','Drivetrain'],
 budget:['Maintenance','Brakes','Suspension','Intake','Exhaust'],
 balanced:['Brakes','Suspension','Cooling','Intake','Exhaust','Drivetrain']
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currentResult=null;
function safeState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
function getPrice(p){try{return typeof lowestPrice==='function'?lowestPrice(p):null}catch{return null}}
function isVerified(p){try{return typeof fitmentVerified==='function'?fitmentVerified(p):false}catch{return false}}
function goalMatch(p,goal){const hay=[...(p.goals||[]),...(p.tags||[]),p.category,p.name,p.description].filter(Boolean).join(' ').toLowerCase();return goal&&goal!=='balanced'&&hay.includes(goal.toLowerCase())}
function candidateScore(p,goal){const price=getPrice(p),rating=Number(p.rating?.overall);let score=0;if(isVerified(p))score+=100;if(goalMatch(p,goal))score+=35;if(Number.isFinite(rating))score+=rating*4;if(Number.isFinite(price)&&price>0)score+=Math.max(0,18-Math.log10(price+10)*6);return score}
function buildItemCost(p,meta={}){const quantity=Math.max(1,Math.floor(Number(meta.quantity)||1));const paid=meta.paid==null||meta.paid===''?null:Number(meta.paid);const unit=Number.isFinite(paid)&&paid>=0?paid:getPrice(p);return Number.isFinite(unit)?unit*quantity:0}
function existingBuildCost(s){if(!s||!Array.isArray(s.build))return 0;return s.build.reduce((sum,id)=>{try{const p=part(id);return p?sum+buildItemCost(p,s.buildMeta?.[id]||{}):sum}catch{return sum}},0)}
function conflictsWith(p,ids){if((p.conflicts||[]).some(id=>ids.has(id)))return true;for(const id of ids){try{if(part(id)?.conflicts?.includes(p.id))return true}catch{}}return false}
function eligiblePart(p,ids){return !!p&&!ids.has(p.id)&&isVerified(p)&&Number.isFinite(getPrice(p))&&getPrice(p)>0&&!conflictsWith(p,ids)}
function dependencyBundle(root,ids,candidateById){
 const bundle=[],planned=new Set(ids),visiting=new Set();
 function visit(p){
  if(planned.has(p.id))return true;
  if(visiting.has(p.id)||!eligiblePart(p,planned))return false;
  visiting.add(p.id);
  for(const reqId of p.requires||[]){if(planned.has(reqId))continue;const req=candidateById.get(reqId);if(!req||!visit(req)){visiting.delete(p.id);return false}}
  visiting.delete(p.id);if(conflictsWith(p,planned))return false;planned.add(p.id);bundle.push(p);return true;
 }
 return visit(root)?bundle:null;
}
function choosePlan(profile){
 const s=safeState();if(!s||typeof compatibleParts!=='function')return {picks:[],budget:0,remaining:0,goal:'balanced',existingCost:0};
 const goal=['balanced','reliability','power','handling','track','budget'].includes(profile?.primaryGoal)?profile.primaryGoal:'balanced';
 const budget=Number(profile?.budget)>0?Number(profile.budget):(Number(s.budget)>0?Number(s.budget):5000);const existingCost=existingBuildCost(s);let remaining=Math.max(0,budget-existingCost);
 const existing=new Set(s.build||[]),existingCategories=new Set((s.build||[]).map(id=>{try{return part(id)?.category}catch{return null}}).filter(Boolean));
 const all=compatibleParts().filter(p=>isVerified(p)&&Number.isFinite(getPrice(p))&&getPrice(p)>0);const candidateById=new Map(all.map(p=>[p.id,p]));
 const candidates=all.filter(p=>eligiblePart(p,existing)).sort((a,b)=>candidateScore(b,goal)-candidateScore(a,goal)||getPrice(a)-getPrice(b));
 const picks=[],plannedIds=new Set(existing),usedCategories=new Set(existingCategories),ordered=CATEGORY_ORDER[goal]||CATEGORY_ORDER.balanced;
 function tryAdd(root){
  if(!root||usedCategories.has(root.category)||plannedIds.has(root.id))return false;
  const bundle=dependencyBundle(root,plannedIds,candidateById);if(!bundle?.length)return false;
  const newParts=bundle.filter(p=>!plannedIds.has(p.id));const cost=newParts.reduce((sum,p)=>sum+getPrice(p),0);
  if(cost>remaining||picks.length+newParts.length>6)return false;
  for(const p of newParts){picks.push(p);plannedIds.add(p.id);usedCategories.add(p.category)}remaining-=cost;return true;
 }
 for(const category of ordered){for(const option of candidates.filter(x=>x.category===category&&!plannedIds.has(x.id)))if(tryAdd(option))break;if(picks.length>=6)break}
 if(picks.length<4){for(const p of candidates){if(tryAdd(p)&&picks.length>=6)break}}
 return {picks,budget,remaining,goal,existingCost};
}
function renderPlan(result){
 const root=document.querySelector('#garageBuildPlan');if(!root)return;
 if(!result){root.innerHTML='<div class="garage-empty compact">Generate a draft to get a budget-aware shortlist from source-listed parts. Recorded supporting requirements and conflicts are checked before a part enters the draft.</div>';return}
 if(!result.picks.length){root.innerHTML='<div class="garage-empty compact">No additional source-listed priced parts fit the remaining budget and recorded dependency/conflict rules. Existing build items were left unchanged.</div>';return}
 const total=result.picks.reduce((sum,p)=>sum+getPrice(p),0);root.innerHTML=`<div class="plan-summary"><strong>${result.picks.length} part draft</strong><span>${money(total)} new parts · ${money(result.remaining)} remaining before labor</span></div>${result.picks.map(p=>`<article class="plan-item"><div><span class="eyebrow">${esc(p.category||'Part')}</span><strong>${esc(p.brand||'')} ${esc(p.name||'')}</strong><small>${isVerified(p)?'source-listed fitment':'confirm fitment'}${p.requires?.length?' · recorded requirements included':''}</small></div><span>${money(getPrice(p))}</span></article>`).join('')}<p class="garage-note">This deterministic draft respects the Garage budget, existing quantities/paid-price overrides, recorded requirements and recorded conflicts. It does not add horsepower claims together.</p>`;
}
function generatePlan(){const profile=window.ModPickerGarage?.getProfile?.()||{};currentResult=choosePlan(profile);renderPlan(currentResult);if(typeof toast==='function')toast(currentResult.picks.length?`${currentResult.picks.length} dependency-checked draft parts ready.`:'No additional parts fit the current budget and recorded rules.');return currentResult}
function addPlanToBuild(){
 const result=currentResult||generatePlan(),s=safeState();if(!s||!result?.picks?.length)return result;
 s.goal=result.goal;s.budget=result.budget;s.build=Array.isArray(s.build)?s.build:[];s.buildMeta=s.buildMeta||{};let added=0;
 for(const p of result.picks){if(!s.build.includes(p.id)){s.build.push(p.id);added++}s.buildMeta[p.id]=s.buildMeta[p.id]||{status:'planned'};if(!s.buildMeta[p.id].note)s.buildMeta[p.id].note=`Garage draft (${result.goal}). Recorded requirements/conflicts were checked; verify final configuration and installation requirements before purchase.`}
 const v=typeof vehicle==='function'?vehicle():null;s.buildName=`${v?`${v.year} ${v.make} ${v.model}`:'Vehicle'} ${result.goal} starter build`;if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();if(typeof toast==='function')toast(added?`${added} dependency-checked parts added to the build sheet.`:'Draft parts are already in the build sheet.');if(typeof route==='function')route('build');return result;
}
function init(){
 const generate=document.querySelector('#generateGaragePlan'),add=document.querySelector('#addGaragePlanToBuild');if(!window.ModPickerGarage||!generate||!add||generate.dataset.dependencyPlannerBound)return false;
 generate.dataset.dependencyPlannerBound='1';add.dataset.dependencyPlannerBound='1';generate.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();generatePlan()},true);add.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();addPlanToBuild()},true);renderPlan(null);window.ModPickerPlanner={generatePlan,addPlanToBuild,choosePlan:()=>choosePlan(window.ModPickerGarage?.getProfile?.()||{}),getCurrentPlan:()=>currentResult?structuredClone({picks:currentResult.picks.map(p=>p.id),budget:currentResult.budget,remaining:currentResult.remaining,goal:currentResult.goal,existingCost:currentResult.existingCost}):null};return true;
}
if(!init()){const obs=new MutationObserver(()=>{if(init())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});const timer=setInterval(()=>{if(init())clearInterval(timer)},100);setTimeout(()=>clearInterval(timer),10000)}
})();
