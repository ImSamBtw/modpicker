const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fixture=require('./dreamspec-fixture.cjs');
const server=spawn('python',['-m','http.server','8126'],{cwd:require('node:path').join(__dirname,'..'),stdio:'ignore'});
(async()=>{let browser;try{
 await new Promise(r=>setTimeout(r,500));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://pzxofwrdidvqhdlqbehk.supabase.co/**',r=>r.abort());
 const mock=await fixture.install(page);
 await page.goto('http://localhost:8126',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.DSGuided&&window.ModPickerGarage);
 assert.equal(await page.title(),'Dream Spec — Build smarter');
 assert.equal(await page.locator('html').getAttribute('data-ds-color'),'light');
 assert.equal(await page.locator('html').getAttribute('data-ds-ui'),'racing');
 assert.equal(await page.locator('.home-path').count(),4);
 await page.screenshot({path:'/tmp/dreamspec-home-light.png',fullPage:true});
 await page.locator('#colorModeToggle').click();await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('html').getAttribute('data-ds-color'),'dark');
 await page.screenshot({path:'/tmp/dreamspec-home-dark.png',fullPage:true});
 await page.evaluate(()=>route('account',false));
 await page.locator('#appearanceSelect').selectOption('classic');
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('html').getAttribute('data-ds-ui'),'classic');
 assert.equal(await page.locator('html').getAttribute('data-ds-color'),'dark');
 await page.locator('#appearanceSelect').selectOption('racing');
 await page.locator('#colorModeToggle').click();

 // Direct navigation and route restoration must both respect authentication.
 for(const name of ['garage','diagnose']){
  await page.evaluate(name=>route(name,false),name);
  assert.equal(await page.locator('#accountView').isVisible(),true);
  assert.equal(await page.locator('#'+name+'View').isVisible(),false);
 }
 await page.reload({waitUntil:'networkidle'});assert.ok(await page.locator('#accountView').isVisible());
 await page.evaluate(()=>route('home',false));
 await page.locator('.home-path[data-home-go="goals"]').click();
 assert.ok(await page.locator('#goalsView').isVisible());
 const before=await page.evaluate(()=>JSON.stringify(state.build));
 await page.locator('#guidedPlanForm button[type="submit"]').click();
 assert.equal(await page.evaluate(()=>JSON.stringify(state.build)),before);
 assert.ok(await page.locator('#guidedPlan').innerText());
 await page.locator('[data-goal="offroad"]').click();
 await page.locator('#guidedPlanForm button[type="submit"]').click();
 assert.match(await page.locator('#guidedPlan').innerText(),/coverage|No additional/);
 await page.screenshot({path:'/tmp/dreamspec-goals.png',fullPage:true});

 // Recovery must survive an asynchronous password update and allow a failed update to be retried.
 const recoveryPage=await browser.newPage();
 recoveryPage.on('pageerror',e=>errors.push(e.message));
 await recoveryPage.route('https://pzxofwrdidvqhdlqbehk.supabase.co/**',r=>r.abort());
 await fixture.install(recoveryPage);
 let passwordUpdates=0;
 await recoveryPage.route('**/auth/v1/user',async r=>{
  if(r.request().method()!=='PUT')return r.fallback();
  passwordUpdates++;
  assert.equal(r.request().postDataJSON().password,'Replacement-test-password-12345');
  if(passwordUpdates===1)return r.fulfill({status:422,json:{msg:'Try a different password.'}});
  return r.fulfill({json:{id:mock.A,email:'owner@example.test'}});
 });
 await recoveryPage.goto('http://localhost:8126/#access_token=test-'+mock.A+'&refresh_token=refresh-'+mock.A+'&expires_in=3600&type=recovery',{waitUntil:'networkidle'});
 await recoveryPage.waitForSelector('#passwordRecoveryForm:visible');
 assert.equal(new URL(recoveryPage.url()).hash,'','recovery tokens must be removed from the URL');
 assert.equal(await recoveryPage.locator('#accountForm').isVisible(),false);
 await recoveryPage.locator('#passwordRecoveryForm input').fill('Replacement-test-password-12345');
 await recoveryPage.locator('#passwordRecoveryForm button').click();
 await recoveryPage.waitForFunction(()=>document.querySelector('#accountStatus').textContent==='Try a different password.');
 assert.ok(await recoveryPage.locator('#passwordRecoveryForm').isVisible(),'a rejected password must leave recovery available');
 assert.equal(await recoveryPage.evaluate(()=>window.DreamSpecPasswordRecovery),true);
 await recoveryPage.locator('#passwordRecoveryForm button').click();
 await recoveryPage.waitForFunction(()=>document.querySelector('#accountStatus').textContent!=='Try a different password.',{},{timeout:5000});
 assert.equal(await recoveryPage.locator('#accountStatus').innerText(),'Password updated.');
 assert.equal(passwordUpdates,2);
 assert.equal(await recoveryPage.locator('#passwordRecoveryForm input').inputValue(),'','successful recovery must clear the password field');
 assert.equal(await recoveryPage.locator('#passwordRecoveryForm').isVisible(),false);
 assert.equal(await recoveryPage.evaluate(()=>window.DreamSpecPasswordRecovery),false);
 assert.ok(await recoveryPage.locator('#signedInAccount').isVisible());
 await recoveryPage.close();

 await fixture.signIn(page);
 await page.evaluate(()=>route('garage',false));
 await page.locator('#garageNickname').fill('My first Z3');
 await page.locator('#garageNickname').dispatchEvent('input');
 await page.evaluate(()=>DSOwned.flush());
 assert.equal(mock.rows.find(r=>r.id===mock.first).profile.nickname,'My first Z3');
 await page.locator('#newVehicleNickname').fill('My second Z3');
 await page.locator('#addOwnedVehicle').click();
 await page.waitForFunction(()=>window.DSOwned?.vehicles.length===2&&window.DSOwned.active?.nickname==='My second Z3');
 const second=await page.evaluate(()=>DSOwned.active.id);
 await page.locator('#garageNickname').fill('Separate vehicle profile');
 await page.locator('#garageNickname').dispatchEvent('input');await page.evaluate(()=>DSOwned.flush());
 await page.locator('#ownedVehicleSelect').selectOption(mock.first);
 await page.waitForFunction(()=>document.querySelector('#garageNickname').value==='My first Z3');
 await page.locator('#ownedVehicleSelect').selectOption(second);
 await page.waitForFunction(()=>document.querySelector('#garageNickname').value==='Separate vehicle profile');
 assert.equal(await page.evaluate(()=>localStorage.getItem('modpicker-owner-garage-v1')),null,'cloud profiles must not leak into legacy storage');
 const imageData=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const context=canvas.getContext('2d');context.fillStyle='#164fb0';context.fillRect(0,0,32,32);return canvas.toDataURL('image/png').split(',')[1]});
 await page.locator('#garagePhotoInput').setInputFiles({name:'private-test-car.png',mimeType:'image/png',buffer:Buffer.from(imageData,'base64')});
 await page.waitForFunction(()=>DSOwned.active.profile.photos.length===1);await page.evaluate(()=>DSOwned.flush());
 const cloudPhoto=mock.rows.find(r=>r.id===second).profile.photos[0];
 assert.ok(cloudPhoto.path.startsWith(mock.A+'/'+second+'/'));assert.equal(cloudPhoto.data,undefined,'signed URLs/data must not be persisted in profile JSON');
 await page.screenshot({path:'/tmp/dreamspec-garage.png',fullPage:true});

 await page.evaluate(()=>route('diagnose',false));
 assert.equal(await page.locator('#diagnosisForm').isVisible(),false);
 const key='sk-proj-browser-test-do-not-store-123456';
 await page.locator('#diagnosisApiKey').fill(key);
 await page.locator('#diagnosisKeyForm button').click();
 assert.ok(await page.locator('#diagnosisForm').isVisible());
 const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));assert.ok(!storage.includes(key));
 await page.locator('#diagnosisForm textarea').fill('Rough idle and a lean code on a cold start');
 await page.locator('#diagnosisForm input[name="codes"]').fill('P0171');
 await page.locator('#diagnosisForm button[type="submit"]').click();
 await page.waitForSelector('#diagnosisResult .ds-card');
 assert.match(await page.locator('#diagnosisResult').innerText(),/unconfirmed/);
 assert.ok(await page.locator('#diagnosisResult a[href*="corvetteforum.com"]').count());
 assert.equal(mock.calls.filter(c=>c.url.includes('/functions/')).length,1);
 await page.evaluate(()=>route('garage',false));
 await page.waitForFunction(()=>document.querySelector('#diagnosisHistory').textContent.includes('intake leak'));
 assert.equal(mock.events[0].vehicle_id,second,'log to the vehicle selected for diagnosis');
 assert.match(await page.locator('#diagnosisHistory').innerText(),/Rough idle|Inspect for an intake leak/);
 await page.evaluate(()=>route('diagnose',false));await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#diagnosisForm').isVisible(),false,'AI key must be cleared on reload');

 // A second account cannot see the previous account's profile or cached form data.
 await page.evaluate(()=>DSAuth.signOut());
 assert.equal(await page.locator('#garageNickname').inputValue(),'');
 await fixture.signIn(page,'other@example.test');
 assert.equal(await page.locator('#garageNickname').inputValue(),'Other account project');
 assert.ok(!(await page.locator('#diagnosisHistory').innerText()).includes('Rough idle'));
 await page.evaluate(()=>DSAuth.signOut());
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const view of ['home','goals','catalog','account','prices','rankings','compare','build']){
   await page.evaluate(v=>route(v,false),view);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,view+' overflows '+width);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>route('home',false));
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');
 await page.screenshot({path:'/tmp/dreamspec-home-mobile.png',fullPage:true});
 await page.locator('#mobileMenuButton').click();assert.equal(await page.locator('#mobileMenuButton').getAttribute('aria-expanded'),'true');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#mobileMenuButton').getAttribute('aria-expanded'),'false');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.home-path').first().evaluate(x=>getComputedStyle(x).transitionDuration),'0s');
 assert.deepEqual(errors,[]);
 console.log('PASS: four paths, light default, persistent/reversible appearance, login guards, password recovery and retry, independent owned vehicles, private account isolation, BYOK reset, diagnostic logging and responsive layouts.');
}finally{await browser?.close();server.kill()}})().catch(e=>{console.error(e);process.exitCode=1});
