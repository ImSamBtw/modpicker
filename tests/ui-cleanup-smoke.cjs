const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {chromium}=require('playwright');
const server=spawn('python',['-m','http.server','8125'],{cwd:path.join(__dirname,'..'),stdio:'ignore'});
(async()=>{let browser;try{
  await new Promise(r=>setTimeout(r,450));
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://pzxofwrdidvqhdlqbehk.supabase.co/**',r=>r.abort());
  await page.goto('http://localhost:8125',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.modpickerUi==='refresh-v1');
  await page.waitForSelector('.home-actions');

  assert.match(await page.locator('#catalogView .hero h1').innerText(),/Parts that fit/);
  assert.equal(await page.locator('.home-actions .button').count(),3);
  assert.equal(await page.locator('.hero-stats>div:visible').count(),3);
  assert.match(await page.locator('.prototype-banner').innerText(),/Evidence-first catalog/);
  assert.equal(await page.locator('.sidebar-card:visible').count(),0,'explanation cards should not clutter the default catalog view');
  assert.equal(await page.locator('.part-card .score-list:visible').count(),0,'metric breakdown belongs in details, not the default card scan path');
  assert.equal(await page.locator('.part-card .quick-meta:visible').count(),0,'dense metadata should stay out of default cards');

  await page.waitForSelector('.filter-advanced-toggle');
  assert.ok(await page.locator('.filter-advanced-toggle').isVisible());
  assert.equal(await page.locator('#difficultyFilter').isVisible(),false);
  await page.locator('.filter-advanced-toggle').click();
  assert.equal(await page.locator('.filter-advanced-toggle').getAttribute('aria-expanded'),'true');
  assert.ok(await page.locator('#difficultyFilter').isVisible());
  assert.ok(await page.locator('#maxPriceFilter').isVisible());
  assert.ok(await page.locator('#sortSelect').isVisible());
  assert.ok(await page.locator('#hideUnverified').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

  await page.locator('.part-card .button.secondary').filter({hasText:'Details'}).first().click();
  assert.ok(await page.locator('#partDialog').isVisible());
  await page.locator('#dialogClose').click();

  for(const route of ['catalog','prices','rankings','compare','build']){
    await page.evaluate(r=>window.route(r,false),route);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} should fit desktop viewport`);
  }

  await page.evaluate(()=>window.route('catalog',false));
  await page.getByRole('button',{name:'Open my garage'}).click();
  await page.waitForSelector('#garageView.active-view');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Garage should fit desktop viewport');

  await page.setViewportSize({width:390,height:844});
  for(const route of ['catalog','prices','rankings','compare','build','garage']){
    await page.evaluate(r=>window.route(r,false),route);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} should not overflow mobile viewport`);
  }
  await page.evaluate(()=>window.route('catalog',false));
  assert.equal(await page.locator('.main-nav').isVisible(),false);
  await page.locator('#mobileMenuButton').click();
  assert.ok(await page.locator('.main-nav').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

  assert.deepEqual(errors,[]);
  console.log('PASS: simplified landing page, progressive filters, compact catalog cards, all primary routes and mobile navigation.');
}finally{await browser?.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
