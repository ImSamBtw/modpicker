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
function safeState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
function getPrice(p){try{return typeof lowestPrice==='function'?lowestPrice(p):null}catch{return null}}
function isVerified(p){try{return typeof fitmentVerified==='function'?fitmentVerified(p):false}catch{return false}}
function goalMatch(p,goal){
 const hay=[...(p.goals||[]),...(p.tags||[]),p.category,p.name,p.description].filter(Boolean).join(' ').toLowerCase();
 return goal&&goal!=='balanced'&&hay.includes(goal.toLowerCase());
}
function candidateScore(p,goal){
 const price=getPrice(p),rating=Number(p.rating?.overall);
 let score=0;
 if(isVerified(p))score+=100;
 if(goalMatch(p,goal))score+=35;
 if(Number.isFinite(rating))score+=rating*4;
 if(Number.isFinite(price)&&price>0)score+=Math.max(0,18-Math.log10(price+10)*6);
 return score;
}
function existingBuildCost(s){
 if(!s||!Array.isArray(s.build))return 0;
 return s.build.reduce((sum,id)=>{try{const p=part(id),meta=s.buildMeta?.[id]||{},qty=Math.max(1,Number(meta.qty)||1),override=Number(meta.priceOverride),price=Number.isFinite(override)&&override>0?override:getPrice(p);return sum+(Number.isFinite(price)?price*qty:0)}catch{return sum}},0);
}
function choosePlan(profile){
 const s=safeState();if(!s||typeof compatibleParts!=='function')return {picks:[],budget:0,remaining:0,goal:'balanced'};
 const goal=['balanced','reliability','power','handling','track','budget'].includes(profile?.primaryGoal)?profile.primaryGoal:'balanced';
 const budget=Number(profile?.budget)>0?Number(profile.budget):(Number(s.budget)>0?Number(s.budget):5000);
 let remaining=Math.max(0,budget-existingBuildCost(s));
 const existing=new Set(s.build||[]),existingCategories=new Set((s.build||[]).map(id=>{try{return part(id)?.category}catch{return null}}).filter(Boolean));
 const candidates=compatibleParts().filter(p=>!existing.has(p.id)&&isVerified(p)&&Number.isFinite(getPrice(p))&&getPrice(p)>0).sort((a,b)=>candidateScore(b,goal)-candidateScore(a,goal)||getPrice(a)-getPrice(b));
 const picks=[];const usedCategories=new Set(existingCategories);const ordered=CATEGORY_ORDER[goal]||CATEGORY_ORDER.balanced;
 for(const category of ordered){
  const p=candidates.find(x=>!usedCategories.has(x.category)&&x.category===category&&getPrice(x)<=remaining);
  if(!p)continue;picks.push(p);usedCategories.add(p.category);remaining-=getPrice(p);if(picks.length>=6)break;
 }
 if(picks.length<4){
  for(const p of candidates){
   if(picks.includes(p)||usedCategories.has(p.category)||getPrice(p)>remaining)continue;
   picks.push(p);usedCategories.add(p.category);remaining-=getPrice(p);if(picks.length>=6)break;
  }
 }
 return {picks,budget,remaining,goal};
}
function renderPlanSummary(result){
 const root=document.querySelector('#garagePlanResult');if(!root)return;
 if(!result){root.innerHTML='<p class="garage-note">Generate a starter build to add a small set of source-listed parts without clearing anything already in your build sheet.</p>';return}
 if(!result.picks.length){root.innerHTML='<div class="garage-empty compact">No additional source-listed priced parts fit the remaining budget. Existing build items were left unchanged.</div>';return}
 const total=result.picks.reduce((s,p)=>s+getPrice(p),0);
 root.innerHTML=`<div class="planner-summary"><strong>${result.picks.length} parts added · ${money(total)}</strong><span>${result.goal} starter plan · ${money(result.remaining)} budget remaining before labor</span></div><ul class="garage-roadmap-list">${result.picks.map(p=>`<li>${p.brand} ${p.name} — ${money(getPrice(p))}</li>`).join('')}</ul>`;
}
function generatePlan(){
 if(!window.ModPickerGarage)return;
 const profile=window.ModPickerGarage.getProfile();const result=choosePlan(profile),s=safeState();if(!s)return;
 if(!result.picks.length){renderPlanSummary(result);if(typeof toast==='function')toast('No additional verified priced parts fit this budget.');return result}
 s.goal=result.goal;s.budget=result.budget;s.build=Array.isArray(s.build)?s.build:[];s.buildMeta=s.buildMeta||{};
 for(const p of result.picks){if(!s.build.includes(p.id))s.build.push(p.id);s.buildMeta[p.id]=s.buildMeta[p.id]||{status:'planned'};if(!s.buildMeta[p.id].note)s.buildMeta[p.id].note=`Starter plan from Garage profile (${result.goal}). Verify final configuration and installation requirements before purchase.`}
 const v=typeof vehicle==='function'?vehicle():null;s.buildName=`${v?`${v.year} ${v.make} ${v.model}`:'Vehicle'} ${result.goal} starter build`;
 if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();renderPlanSummary(result);if(typeof toast==='function')toast(`${result.picks.length} starter-plan parts added.`);if(typeof route==='function')route('build');return result;
}
function init(){
 const button=document.querySelector('#generateBuildPlan');if(!button||button.dataset.bound)return false;button.dataset.bound='1';button.addEventListener('click',generatePlan);renderPlanSummary(null);window.ModPickerPlanner={generatePlan,choosePlan:()=>choosePlan(window.ModPickerGarage?.getProfile?.()||{})};return true;
}
if(!init()){
 const obs=new MutationObserver(()=>{if(window.ModPickerGarage&&init())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});
 const timer=setInterval(()=>{if(window.ModPickerGarage&&init())clearInterval(timer)},250);setTimeout(()=>clearInterval(timer),10000);
}
})();
