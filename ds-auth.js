/* Supabase Auth REST adapter. AI credentials never enter this module or storage. */
(()=>{
'use strict';
const cfg=window.DREAM_SPEC_CONFIG,SESSION_KEY='dreamspec-auth-v1';
let session=null,user=null,refreshing=null,epoch=0,next='garage';
const listeners=new Set();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function emit(){
 for(const fn of listeners)fn(user);
 document.dispatchEvent(new CustomEvent('ds:auth',{detail:{user}}));
 const button=document.querySelector('#accountButton');if(button)button.textContent=user?'Account':'Log in';
}
function save(value){
 session=value;
 try{if(value)sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));else sessionStorage.removeItem(SESSION_KEY)}catch{}
}
async function auth(path,body,token,method='POST'){
 const headers={'apikey':cfg.publishableKey,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(cfg.supabaseUrl+'/auth/v1/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const e=new Error(data.msg||data.message||data.error_description||'Authentication failed. Please try again.');e.status=response.status;throw e}
 return data;
}
async function verify(value){
 const remote=await auth('user',null,value.access_token,'GET');
 if(!uuid.test(remote.id||''))throw new Error('Invalid account response.');
 return remote;
}
function normalized(value){return {access_token:value.access_token,refresh_token:value.refresh_token,expires_at:Math.floor(Date.now()/1000)+(Number(value.expires_in)||3600)}}
async function refresh(){
 if(refreshing)return refreshing;
 const expected=epoch;
 refreshing=(async()=>{
  if(!session?.refresh_token)throw new Error('Please log in to continue.');
  try{
   const value=await auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token});
   const remote=await verify(value);if(epoch!==expected)throw new Error('Session changed.');
   save(normalized(value));user=remote;return session.access_token;
  }catch(e){if(epoch===expected&&[400,401,403].includes(e.status)){save(null);user=null;emit()}throw e}
 })().finally(()=>{refreshing=null});
 return refreshing;
}
async function token(){if(!user||!session)throw new Error('Please log in to continue.');return Number(session.expires_at)*1000-Date.now()<60000?refresh():session.access_token}
async function request(path,options={}){
 const expected=epoch,bearer=await token();
 const headers={apikey:cfg.publishableKey,Authorization:'Bearer '+bearer,'Content-Type':'application/json',...options.headers};
 const response=await fetch(cfg.supabaseUrl+'/rest/v1/'+path,{...options,headers,signal:options.signal||AbortSignal.timeout(20000)});
 if(expected!==epoch)throw new Error('Session changed. Please try again.');
 const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=null}
 if(!response.ok){
  const e=new Error(response.status===401?'Your session expired. Please log in again.':response.status===409?'This item changed or already exists. Reload your garage and try again.':'Your garage is temporarily unavailable. Please try again.');
  e.status=response.status;e.code=data?.code;
  if(response.status===401){save(null);user=null;emit()}
  throw e;
 }
 return data;
}
async function signIn(email,password){
 const expected=++epoch;const value=await auth('token?grant_type=password',{email,password});
 const remote=await verify(value);if(expected!==epoch)throw new Error('Session changed.');
 save(normalized(value));user=remote;emit();return user;
}
async function signUp(email,password){
 const expected=++epoch;const redirect=encodeURIComponent(location.origin+location.pathname);
 const value=await auth('signup?redirect_to='+redirect,{email,password});
 if(!value.access_token)return {confirmationRequired:true};
 const remote=await verify(value);if(expected!==epoch)throw new Error('Session changed.');
 save(normalized(value));user=remote;emit();return {confirmationRequired:false};
}
async function signOut(){
 await window.DSOwned?.flush?.().catch(()=>{});
 const old=session?.access_token;++epoch;save(null);user=null;emit();
 if(old)await auth('logout?scope=local',null,old).catch(()=>{});
 if(typeof route==='function')route('home');
}
async function recover(email){await auth('recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{email})}
async function updatePassword(password){await auth('user',{password},await token(),'PUT')}
const ready=(async()=>{
 const expected=epoch;
 try{
  const hash=new URLSearchParams(location.hash.slice(1));
  let saved=null;try{saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{}
  if(hash.has('access_token')&&hash.has('refresh_token')){
   saved={access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)};
   window.history.replaceState(null,'',location.pathname+location.search);
   window.DreamSpecPasswordRecovery=hash.get('type')==='recovery';
  }
  if(!saved?.access_token)return;
  save(saved);
  if(Number(saved.expires_at)*1000<Date.now()+60000){user={id:'restoring'};await refresh()}
  else{const remote=await verify(saved);if(expected!==epoch)return;user=remote}
 }catch{if(expected===epoch){save(null);user=null}}
 finally{emit()}
})();
window.DSAuth={get user(){return uuid.test(user?.id||'')?user:null},ready,token,request,signIn,signUp,signOut,recover,updatePassword,
 get next(){return next},setNext(value){next=['garage','diagnose'].includes(value)?value:'garage'},
 onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)}
};
})();
