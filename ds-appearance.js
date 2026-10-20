/* Runs in <head>, before styles, so the initial page uses the saved appearance. */
(()=>{
'use strict';
const root=document.documentElement;
let value={appearance:window.DREAM_SPEC_CONFIG?.defaultAppearance||'racing',color:'light'};
try{const saved=JSON.parse(localStorage.getItem('dreamspec-appearance-v1')||'null');if(saved){if(['classic','racing'].includes(saved.appearance))value.appearance=saved.appearance;if(['light','dark'].includes(saved.color))value.color=saved.color}}catch{}
function apply(){
 root.dataset.dsUi=value.appearance;root.dataset.dsColor=value.color;root.style.colorScheme=value.color;
 const toggle=document.querySelector('#colorModeToggle'),classic=document.querySelector('#appearanceSelect');
 if(toggle){toggle.textContent=value.color==='light'?'Dark mode':'Light mode';toggle.setAttribute('aria-pressed',String(value.color==='dark'))}
 if(classic)classic.value=value.appearance;
}
function set(next){value={...value,...next};apply();try{localStorage.setItem('dreamspec-appearance-v1',JSON.stringify(value))}catch{}}
apply();
document.addEventListener('DOMContentLoaded',()=>{
 apply();document.querySelector('#colorModeToggle')?.addEventListener('click',()=>set({color:value.color==='light'?'dark':'light'}));
 document.querySelector('#appearanceSelect')?.addEventListener('change',e=>set({appearance:e.target.value}));
});
window.DreamSpecAppearance={get:()=>({...value}),set};
})();
