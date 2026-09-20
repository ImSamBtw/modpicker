const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {chromium}=require('playwright');
const server=spawn('python',['-m','http.server','8124'],{cwd:path.join(__dirname,'..'),stdio:'ignore'});
(async()=>{let browser;try{
  await new Promise(r=>setTimeout(r,500));
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://pzxofwrdidvqhdlqbehk.supabase.co/**',r=>r.abort());
  await page.goto('http://localhost:8124',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-route="garage"]');

  await page.evaluate(()=>{state.browseMode='vehicle';switchVehicle('brz-2017');showPart('brz-perrin-master-brace')});
  await page.waitForSelector('#interchangeSection');
  const interchange=await page.locator('#interchangeSection').textContent();
  assert.match(interchange,/Scion FR-S/);assert.match(interchange,/Toyota 86/);assert.match(interchange,/GR86/);
  await page.locator('#dialogClose').click();

  await page.evaluate(()=>{state.browseMode='vehicle';switchVehicle('z3-2000-28')});
  await page.locator('[data-route="garage"]').click();
  await page.waitForSelector('#garageView.active-view');
  assert.equal(await page.locator('#garageProfileCompleteness').textContent(),'25% context complete');
  await page.locator('#garageOdometer').fill('100000');
  await page.locator('#garageBudget').fill('2500');
  await page.locator('#garageCurrentMods').fill('Stock suspension; replacement cooling system');
  await page.locator('#garageProblems').fill('No active mechanical problems');
  await page.locator('#garageBuildGoals').fill('Reliable street build with sharper handling');
  await page.locator('#garageLikes').fill('Steering feel');
  assert.equal(await page.locator('#garageProfileCompleteness').textContent(),'100% context complete');

  await page.locator('#seedMaintenanceButton').click();
  assert.ok(await page.locator('.maintenance-card').count()>=10);
  const first=page.locator('.maintenance-card').first();
  await first.locator('[data-maint-field="lastMileage"]').fill('90000');
  await first.locator('[data-maint-field="intervalMiles"]').fill('5000');
  await first.locator('[data-maint-field="intervalMiles"]').dispatchEvent('change');
  assert.equal(await first.locator('.maintenance-status').textContent(),'Due');
  await first.locator('[data-service-maint]').click();
  assert.equal(await first.locator('[data-maint-field="lastMileage"]').inputValue(),'100000');
  assert.match(await first.locator('[data-maint-field="lastDate"]').inputValue(),/^\d{4}-\d{2}-\d{2}$/);

  await page.waitForFunction(()=>window.ModPickerPlanner&&window.ModPickerGarage);
  const audit=await page.evaluate(()=>{const plan=window.ModPickerPlanner.choosePlan(),ids=new Set([...state.build,...plan.picks.map(p=>p.id)]);let missing=0,conflicts=0;for(const p of plan.picks){missing+=(p.requires||[]).filter(id=>!ids.has(id)).length;conflicts+=(p.conflicts||[]).filter(id=>ids.has(id)).length}return{missing,conflicts,count:plan.picks.length}});
  assert.equal(audit.missing,0);assert.equal(audit.conflicts,0);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-route="garage"]');await page.locator('[data-route="garage"]').click();
  assert.equal(await page.locator('#garageOdometer').inputValue(),'100000','Garage profile should persist across reloads');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Garage should not overflow on mobile');
  assert.deepEqual(errors,[]);
  console.log('PASS: interchange, Garage completeness, service logging, planner invariants, persistence and mobile layout.');
}finally{await browser?.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
