(()=>{
const displayByKey=new Map([
 ['bmw','BMW'],
 ['ford','Ford'],
 ['honda','Honda'],
 ['mazda','Mazda'],
 ['nissan','Nissan'],
 ['scion','Scion'],
 ['subaru','Subaru'],
 ['toyota','Toyota'],
 ['volkswagen','Volkswagen']
]);
function normalizeMake(value){
 const key=String(value??'').trim().toLowerCase();
 return displayByKey.get(key)||null;
}
function isTrustedMake(value){return normalizeMake(value)!==null;}
function normalizeVehicle(row){
 if(!row||typeof row!=='object'||!row.id||!row.model||!Number.isFinite(Number(row.year)))return null;
 const make=normalizeMake(row.make);
 if(!make)return null;
 return {...row,make};
}
function filterVehicles(rows){
 const byId=new Map();
 for(const row of Array.isArray(rows)?rows:[]){
  const safe=normalizeVehicle(row);
  if(safe)byId.set(String(safe.id),safe);
 }
 return [...byId.values()];
}
function sanitizeCurrent(){
 if(window.MODPICKER_DATA&&Array.isArray(window.MODPICKER_DATA.vehicles))window.MODPICKER_DATA.vehicles=filterVehicles(window.MODPICKER_DATA.vehicles);
 if(window.MODPICKER_PIPELINE_DATA&&Array.isArray(window.MODPICKER_PIPELINE_DATA.vehicles))window.MODPICKER_PIPELINE_DATA.vehicles=filterVehicles(window.MODPICKER_PIPELINE_DATA.vehicles);
}
window.ModPickerVehicleTrust=Object.freeze({trustedMakes:Object.freeze([...displayByKey.values()]),normalizeMake,isTrustedMake,normalizeVehicle,filterVehicles,sanitizeCurrent});
sanitizeCurrent();
})();
