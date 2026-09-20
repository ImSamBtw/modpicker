(()=>{
const previous=window.showPart;
const curated={
 "miata-xida":[
  {title:"Xida Club Sport Coilovers discussion",source:"MX-5 Miata Forum",note:"Long-running product thread with configuration and owner discussion.",url:"https://forum.miata.net/vb/showthread.php?t=408977"},
  {title:"949 Racing Xida coilover owner review",source:"MX-5 Miata Forum",note:"Detailed owner review covering street and autocross use.",url:"https://forum.miata.net/vb/showthread.php?t=699243"},
  {title:"How to Xida",source:"MX-5 Miata Forum",note:"Community setup discussion covering Xida families, ride heights and intended use.",url:"https://forum.miata.net/vb/showthread.php?t=664199"}
 ],
 "brz-header":[
  {title:"EL vs UEL header discussion",source:"FT86Club",note:"Owner discussion comparing equal-length and unequal-length header tradeoffs and mentioning JDL UEL options.",url:"https://www.ft86club.com/forums/showthread.php?t=49638"},
  {title:"UEL vs EL and long-term use",source:"FT86Club",note:"Community discussion focused on header layout, long-term concerns and JDL/Borla/Nameless options.",url:"https://www.ft86club.com/forums/showthread.php?t=30928"}
 ],
 "mustang-steeda-intake":[
  {title:"Steeda ProFlow intake + tune review",source:"Mustang6G",note:"Owner review with installation photos, first-hand install-time discussion and driving impressions.",url:"https://www.mustang6g.com/forums/threads/steeda-proflow-mustang-cold-air-intake-w-sct-x4-review.22248/"},
  {title:"Installed Steeda ProFlow photos",source:"Mustang6G",note:"Community listing with multiple installed photos and product configuration details.",url:"https://www.mustang6g.com/forums/threads/15-17-steeda-mustang-gt-proflow-cold-air-intake.186854/"}
 ]
};
window.showPart=function(id){
 previous(id);
 const items=curated[id]; if(!items?.length)return;
 const root=document.querySelector('#partDialogContent'); if(!root)return;
 root.insertAdjacentHTML('beforeend',`<section class="research-panel"><span class="eyebrow">Curated community references</span><h3>Direct discussions for this part</h3><div class="research-links">${items.map(x=>`<a class="research-link" href="${x.url}" target="_blank" rel="noopener"><span><strong>${x.title}</strong><br><small>${x.note}</small></span><small>${x.source} ↗</small></a>`).join('')}</div></section>`);
};
})();
