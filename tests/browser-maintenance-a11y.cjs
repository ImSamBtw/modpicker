const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const server=spawn('python',['-m','http.server','8124'],{cwd:path.join(__dirname,'..'),stdio:'ignore'});

(async()=>{let browser;try{
 await new Promise(r=>setTimeout(r,400));
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://pzxofwrdidvqhdlqbehk.supabase.co/**',r=>r.abort());
 await page.goto('http://localhost:8124');
 await page.waitForSelector('[data-route="garage"]');
 let reachedGarage=false;
 for(let i=0;i<14;i++){
  await page.keyboard.press('Tab');
  reachedGarage=await page.evaluate(()=>document.activeElement?.dataset?.route==='garage');
  if(reachedGarage)break;
 }
 assert.equal(reachedGarage,true,'Garage navigation must be reachable with Tab');
 assert.equal(await page.locator('[data-route="garage"]').evaluate(el=>getComputedStyle(el).outlineStyle!=='none'),true,'Keyboard-focused navigation must expose a visible focus outline');
 await page.keyboard.press('Enter');
 await page.waitForSelector('#garageView.active-view');
 await page.waitForFunction(()=>window.ModPickerMaintenanceSpecs?.getPacks?.().length>0);
 await page.waitForFunction(()=>{const p=window.ModPickerGarage?.getProfile?.();return p?.maintenance?.some(x=>x.name==='Engine oil & filter'&&x.capacity==='6.9 US qt (6.5 L) with filter')});

 const sourced=await page.evaluate(()=>{
  const profile=window.ModPickerGarage.getProfile();
  const byName=Object.fromEntries(profile.maintenance.map(x=>[x.name,x]));
  return {oil:byName['Engine oil & filter'],coolant:byName.Coolant};
 });
 assert.equal(sourced.oil.capacity,'6.9 US qt (6.5 L) with filter');
 assert.match(sourced.oil.fluidSpec,/5W-40/);assert.match(sourced.oil.fluidSpec,/5W-30/);
 assert.equal(sourced.oil.intervalMiles,'');assert.equal(sourced.oil.intervalMonths,'');
 assert.equal(sourced.coolant.capacity,'11.1 US qt (10.5 L) including heater circuit');
 assert.match(sourced.coolant.fluidSpec,/50:50/);
 assert.equal(sourced.coolant.intervalMiles,'');assert.equal(sourced.coolant.intervalMonths,'');
 const sourceLinks=page.locator('.maintenance-source-reference a');
 assert.equal(await sourceLinks.count(),2);assert.match(await sourceLinks.first().getAttribute('href'),/^https:\/\/manualzilla\.com\//);
 const report=await page.evaluate(()=>window.ModPickerGarage.getMaintenanceReport());
 assert.match(report,/SOURCED MAINTENANCE REFERENCES/);assert.match(report,/01 41 0 155 149/);assert.match(report,/fixed interval: not stated/);

 const oilCard=page.locator('.maintenance-card').filter({has:page.locator('.maintenance-name').filter({hasValue:'Engine oil & filter'})});
 const capacity=oilCard.locator('[data-maint-field="capacity"]');await capacity.fill('Owner-entered override');await capacity.dispatchEvent('input');
 await page.evaluate(()=>window.ModPickerMaintenanceSpecs.apply());
 assert.equal(await capacity.inputValue(),'Owner-entered override','Source refresh must not overwrite a populated user field');
 await page.screenshot({path:'/tmp/modpicker-maintenance-desktop.png',fullPage:true});

 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.route('catalog',false));
 await page.waitForSelector('.filter-advanced-toggle');
 await page.locator('.filter-advanced-toggle').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('.filter-advanced-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const details=page.locator('.part-card .button.secondary').filter({hasText:'Details'}).first();
 await details.focus();await page.keyboard.press('Enter');await page.waitForSelector('#partDialog[open]');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#partDialog').isVisible(),false,'Escape must close the native details dialog');
 await page.screenshot({path:'/tmp/modpicker-maintenance-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: sourced maintenance values/provenance, no invented intervals, user override preservation, keyboard traversal, dialog escape and mobile overflow.');
}finally{await browser?.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
