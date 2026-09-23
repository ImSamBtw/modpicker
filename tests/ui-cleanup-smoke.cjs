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
  await page.waitForSelector('#homeView.active-view');
  assert.equal(await page.locator('.vehicle-strip').isVisible(),false);
  assert.equal(await page.locator('.prototype-banner').isVisible(),false);
  assert.equal(await page.locator('#partGrid').isVisible(),false);
  assert.equal(await page.locator('.home-path').count(),3);
  assert.ok(await page.locator('.vehicle-showcase img').evaluate(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:'/tmp/modpicker-home-desktop.png',fullPage:true});

  // Every landing-page path works, and the logo gets users home again.
  for(const route of ['garage','build','catalog']){
    await page.locator(`.home-path[data-home-go="${route}"]`).click();
    await page.waitForSelector(`#${route}View.active-view`);
    assert.ok(await page.locator('.vehicle-strip').isVisible());
    await page.locator('.brand').click();
    await page.waitForSelector('#homeView.active-view');
  }
  await page.locator('.research-nav summary').click();
  await page.locator('.research-menu [data-route="prices"]').click();
  await page.waitForSelector('#pricesView.active-view');
  assert.equal(await page.locator('.research-nav').getAttribute('open'),null);
  await page.locator('.brand').click();
  await page.locator('.home-cta').click();
  assert.ok(await page.locator('#applicationSearch').evaluate(el=>el===document.activeElement));
  assert.match(await page.locator('#catalogView .hero h1').innerText(),/Find your next upgrade/);
  assert.equal(await page.locator('.hero-stats').isVisible(),false);
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

  await page.evaluate(()=>window.route('home',false));
  await page.locator('.home-path[data-home-go="garage"]').click();
  await page.waitForSelector('#garageView.active-view');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Garage should fit desktop viewport');

  await page.setViewportSize({width:390,height:844});
  for(const route of ['home','catalog','prices','rankings','compare','build','garage']){
    await page.evaluate(r=>window.route(r,false),route);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} should not overflow mobile viewport`);
  }
  await page.evaluate(()=>window.route('catalog',false));
  assert.equal(await page.locator('.main-nav').isVisible(),false);
  await page.locator('#mobileMenuButton').click();
  assert.ok(await page.locator('.main-nav').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

  assert.equal(await page.locator('#mobileMenuButton').getAttribute('aria-expanded'),'true');
  await page.locator('.main-nav [data-route="home"]').click();
  assert.equal(await page.locator('#mobileMenuButton').getAttribute('aria-expanded'),'false');
  assert.ok(await page.locator('#homeView').isVisible());
  await page.screenshot({path:'/tmp/modpicker-home-mobile.png',fullPage:true});
  for(const width of [320,768,1024]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`home fits ${width}px`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.research-nav summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.research-nav').getAttribute('open'),'');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.research-nav').getAttribute('open'),null);
  assert.ok(await page.locator('.research-nav summary').evaluate(el=>el===document.activeElement));
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.home-path').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  assert.deepEqual(errors,[]);
  console.log('PASS: home entry points, showcase, keyboard navigation, progressive filters, compact catalog cards, all primary routes and mobile navigation.');
}finally{await browser?.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
