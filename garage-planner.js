/* Compatibility adapter: Garage and the public goal route share one planner. */
(()=>{
'use strict';
function choosePlan(){const p=window.ModPickerGarage?.getProfile?.()||{};return DreamSpecCore.draftPlan({parts:DATA.parts,vehicleId:state.vehicleId,goal:p.primaryGoal||'balanced',budget:p.budget||null,laborRate:state.laborRate,existing:state.build,existingMeta:state.buildMeta})}
function generatePlan(){const p=window.ModPickerGarage?.getProfile?.()||{};window.DSGuided?.preview(p);return choosePlan()}
function init(){const b=document.querySelector('#generateBuildPlan');if(!b||b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',generatePlan);window.ModPickerPlanner={choosePlan,generatePlan}}
document.addEventListener('ds:garage-ready',init);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
