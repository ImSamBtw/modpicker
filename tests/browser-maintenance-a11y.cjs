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
 for(let i=0;i<12;i++){
  await page.keyboard.press('Tab');
  reachedGarage=await page.evaluate(()=>document.activeElement?.dataset?.route==='garage');
  if(reachedGarage)break;
 }
 assert.equal(reachedGarage,true,'Garage navigation must be reachable with Tab');
 assert.equal(await page.locator('[data-route="garage"]').evaluate(el=>getComputedStyle(el).outlineStyle!=='none'),true,'Keyboard-focused navigation must expose a visible focus outline');
 await page.keyboard.press('Enter');
 await page.waitForSelector('#garageView.active-view');
 await page.waitForFunction(()=>window.ModPickerGarage?.getMaintenanceSpecs?.().length>0);
 await page.waitForFunction(()=>window.ModPickerGarage.getProfile().maintenance.some(x=>x.source?.id==='bmw-z3-2000-28-owner-manual'));

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
 assert.equal(sourced.oil.source.documentPartNumber,'01 41 0 155 149');
 assert.ok(await page.locator('.maintenance-source a').first().isVisible());
 assert.match(await page.locator('.maintenance-source a').first().getAttribute('href'),/^https:\/\/manualzilla\.com\//);
 assert.equal(await page.locator('#garageProfileCompleteness').textContent(),'0% context complete');

 const inputs=[
  ['#garageOdometer','100000'],['#garageCurrentMods','Stock'],['#garageProblems','None known'],
  ['#garageBuildGoals','Reliable street car'],['#garageLikes','Comfort'],['#garageDislikes','Noise']
 ];
 for(const [selector,value] of inputs){await page.locator(selector).fill(value);await page.locator(selector).dispatchEvent('input')}
 assert.equal(await page.locator('#garageProfileCompleteness').textContent(),'100% context complete');
 const contextPreview=await page.locator('#garageContextPreview').textContent();
 assert.match(contextPreview,/Reliable street car/);
 assert.match(await page.evaluate(()=>window.ModPickerGarage.getMaintenanceReport()),/BMW Z3 Owner's Manual/);
 await page.screenshot({path:'/tmp/modpicker-maintenance-desktop.png',fullPage:true});

 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.route('catalog',false));
 await page.waitForSelector('.filter-advanced-toggle');
 await page.locator('.filter-advanced-toggle').focus();
 await page.keyboard.press('Enter');
 assert.equal(await page.locator('.filter-advanced-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const details=page.locator('.part-card .button.secondary').filter({hasText:'Details'}).first();
 await details.focus();await page.keyboard.press('Enter');await page.waitForSelector('#partDialog[open]');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#partDialog').isVisible(),false,'Escape must close the native details dialog');
 await page.screenshot({path:'/tmp/modpicker-maintenance-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: sourced maintenance specs, provenance, profile completeness, keyboard traversal, dialog escape and mobile overflow.');
}finally{await browser?.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
