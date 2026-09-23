(()=>{
'use strict';
function loadCss(){if(document.querySelector('link[href="site-refresh.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='site-refresh.css';document.head.appendChild(link)}
function setNavLabel(route,label){const el=document.querySelector(`.main-nav [data-route="${route}"]`);if(!el)return;const nodes=[...el.childNodes];const text=nodes.find(n=>n.nodeType===Node.TEXT_NODE);if(text)text.nodeValue=`${label} `;else el.prepend(document.createTextNode(`${label} `))}
function simplifyHero(){const hero=document.querySelector('#catalogView .hero');if(!hero||hero.dataset.cleaned)return;hero.dataset.cleaned='1';const copy=hero.firstElementChild;copy.querySelector('.eyebrow').textContent='The parts workspace';copy.querySelector('h1').textContent='Find your next upgrade.';copy.querySelector('p').textContent='Choose your vehicle above, then explore parts and compare your options.';hero.querySelector('.hero-stats').hidden=true}
function bindHome(){
 document.querySelectorAll('[data-home-go]').forEach(button=>button.addEventListener('click',()=>{
  window.route(button.dataset.homeGo);
  if(button.dataset.homeGo==='catalog')document.querySelector('#applicationSearch')?.focus({preventScroll:true});
 }));
 const nav=document.querySelector('.main-nav');
 const menu=document.querySelector('#mobileMenuButton');
 const research=document.querySelector('.research-nav');
 new MutationObserver(()=>menu.setAttribute('aria-expanded',String(nav.classList.contains('open'))))
  .observe(nav,{attributes:true,attributeFilter:['class']});
 document.addEventListener('click',event=>{if(!research.contains(event.target))research.open=false});
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(research.open){research.open=false;research.querySelector('summary').focus()}
  else if(nav.classList.contains('open')){nav.classList.remove('open');menu.focus()}
 });
}
function simplifyBanner(){const b=document.querySelector('.prototype-banner');if(!b||b.dataset.cleaned)return;b.dataset.cleaned='1';b.innerHTML='<strong>Evidence-first catalog.</strong> Fitment, ratings and prices keep their source context. <a href="data-status.html">Data status</a>'}
function simplifyPageHeads(){const map={prices:['Compare prices','Recent seller observations for compatible parts. Verify stock, shipping and final checkout price with the seller.'],rankings:['Compare ratings','Published review evidence for compatible products. Missing evidence stays unrated.'],compare:['Compare parts','Put compatible parts side by side without losing fitment or pricing context.']};for(const [route,[title,copy]] of Object.entries(map)){const view=document.querySelector(`#${route}View`);if(!view)continue;const h=view.querySelector('.page-head h1'),p=view.querySelector('.page-head p');if(h)h.textContent=title;if(p)p.textContent=copy}}
function tuneNav(){setNavLabel('prices','Prices');setNavLabel('rankings','Ratings');setNavLabel('build','Build sheet')}
function init(){loadCss();document.body.classList.add('ui-refresh');tuneNav();bindHome();simplifyHero();simplifyBanner();simplifyPageHeads();document.documentElement.dataset.modpickerUi='refresh-v1'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
