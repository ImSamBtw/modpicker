const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const baseVehicles = [
  { id: 'bmw-good', year: 2000, make: 'BMW', model: 'Z3', trim: '2.8' },
  { id: 'cranford-bad', year: 2000, make: 'CRANFORD RADIATOR INC.', model: 'TRAILER', trim: 'Unknown' },
  { id: 'ford-good', year: 2015, make: 'Ford', model: 'Mustang', trim: 'GT' },
  { id: 'fords-bad', year: 2015, make: 'FORDS TRAILER SALES', model: 'TRAILER', trim: 'Unknown' },
];

const snapshotVehicles = [
  { id: 'ford-upper', year: 2016, make: 'FORD', model: 'Mustang', trim: 'GT' },
  { id: 'scion-good', year: 2015, make: 'Scion', model: 'FR-S', trim: 'Base' },
  { id: 'mazda-lower', year: 2001, make: 'mazda', model: 'MX-5 Miata', trim: 'Base' },
  { id: 'affordable-bad', year: 2001, make: 'AFFORDABLE TRAILERS', model: 'UTILITY', trim: 'Unknown' },
  { id: 'mazda-company-bad', year: 2001, make: 'Mazda North American Operation', model: 'MX-5', trim: 'Unknown' },
];

const context = {
  URL,
  window: {
    MODPICKER_DATA: { vehicles: baseVehicles, parts: [], platforms: [] },
    MODPICKER_PIPELINE_DATA: { vehicles: snapshotVehicles, parts: [], platforms: [], status: {} },
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('pipeline-bridge.js', 'utf8'), context, { filename: 'pipeline-bridge.js' });

const trust = context.window.ModPickerVehicleTrust;
assert.ok(trust, 'vehicle trust API should be exposed');
assert.strictEqual(trust.isTrustedMake('Ford'), true);
assert.strictEqual(trust.isTrustedMake('FORD'), true);
assert.strictEqual(trust.isTrustedMake('BMW'), true);
assert.strictEqual(trust.isTrustedMake('Scion'), true);
assert.strictEqual(trust.isTrustedMake('FORDS TRAILER SALES'), false);
assert.strictEqual(trust.isTrustedMake('CRANFORD RADIATOR INC.'), false);
assert.strictEqual(trust.isTrustedMake('Mazda North American Operation'), false);

const makes = [...new Set(context.window.MODPICKER_DATA.vehicles.map(v => v.make))].sort();
assert.deepStrictEqual(makes, ['BMW', 'Ford', 'Mazda', 'Scion']);
assert.ok(!context.window.MODPICKER_DATA.vehicles.some(v => /CRANFORD|TRAILER SALES|AFFORDABLE|North American Operation/i.test(v.make)));

// MP_APPLY is also the entry point used by live Supabase hydration. It must
// fail closed for polluted rows that arrive after the bundled snapshot.
context.window.MP_APPLY([], [
  { id: 'toyota-good', year: 2020, make: 'TOYOTA', model: '86', trim: 'GT' },
  { id: 'eagle-bad', year: 2020, make: 'EAGLE FORD TANKS & TRAILERS LLC', model: 'TANK', trim: 'Unknown' },
], []);

const liveMakes = [...new Set(context.window.MODPICKER_DATA.vehicles.map(v => v.make))].sort();
assert.deepStrictEqual(liveMakes, ['BMW', 'Ford', 'Mazda', 'Scion', 'Toyota']);
assert.ok(!context.window.MODPICKER_DATA.vehicles.some(v => v.id === 'eagle-bad'));

console.log(`Vehicle make trust regression passed: ${liveMakes.join(', ')}`);
