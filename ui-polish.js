(()=>{
'use strict';
function init(){
 const panel=document.querySelector('.filter-panel');if(!panel||panel.dataset.mobileFiltersReady)return false;
 panel.dataset.mobileFiltersReady='1';
 for(const id of ['difficultyFilter','maxPriceFilter','sortSelect','hideUnverified'])document.querySelector(`#${id}`)?.closest('label')?.classList.add('advanced-filter');
 const button=document.createElement('button');button.type='button';button.className='button secondary filter-advanced-toggle';button.setAttribute('aria-expanded','false');button.textContent='More filters';
 button.addEventListener('click',()=>{const open=panel.classList.toggle('show-advanced');button.setAttribute('aria-expanded',String(open));button.textContent=open?'Hide filters':'More filters'});
 const category=document.querySelector('#categoryFilter')?.closest('label');(category||panel.firstElementChild)?.insertAdjacentElement('afterend',button);
 return true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
