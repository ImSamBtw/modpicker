(()=>{
'use strict';
if(document.querySelector('#garageView'))return;
if(!document.querySelector('link[href="garage.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='garage.css';document.head.appendChild(link)}
const nav=document.querySelector('.main-nav');
if(nav&&!nav.querySelector('[data-route="garage"]')){const button=document.createElement('button');button.className='nav-link';button.dataset.route='garage';button.textContent='Garage';const build=nav.querySelector('[data-route="build"]');nav.insertBefore(button,build||null)}
const main=document.querySelector('main');
if(!main)return;
const section=document.createElement('section');section.id='garageView';section.className='view shell garage-view';section.innerHTML=`
  <div class="page-head garage-page-head">
    <div><span class="eyebrow">Virtual garage</span><h1>Your car, not just the catalog.</h1><p>Record the actual condition, modifications, preferences, maintenance and history that should shape future recommendations.</p></div>
    <div class="garage-page-actions"><button id="copyMaintenanceReport" class="button secondary" type="button">Copy maintenance report</button><button id="exportGarageData" class="button secondary" type="button">Export garage JSON</button></div>
  </div>
  <div class="garage-hero-card">
    <div class="garage-hero-main"><div class="garage-vehicle-icon">MY CAR</div><div class="garage-hero-copy"><span class="eyebrow">Current vehicle</span><h2 id="garageVehicleTitle">Selected vehicle</h2><p id="garageVehicleMeta"></p></div></div>
    <div class="garage-profile-meter"><span class="eyebrow">Recommendation context</span><strong id="garageProfileCompleteness">0% context complete</strong><p>More context lets future recommendations avoid parts that conflict with your real car, preferences or maintenance needs.</p></div>
  </div>
  <div class="garage-grid">
    <div class="garage-main-column">
      <section class="garage-card">
        <div class="garage-card-head"><div><span class="eyebrow">Vehicle profile</span><h2>What is this car actually like?</h2><p>This information stays separate for each selected vehicle.</p></div></div>
        <div class="garage-form-grid">
          <label><span>Nickname</span><input id="garageNickname" data-profile-field="nickname" placeholder="Weekend Z3"></label>
          <label><span>Current odometer (miles)</span><input id="garageOdometer" data-profile-field="odometer" type="number" min="0" placeholder="98500"></label>
          <label><span>Condition</span><select id="garageCondition" data-profile-field="condition"><option>Project</option><option>Driver</option><option>Good</option><option>Excellent</option><option>Track / competition</option></select></label>
          <label><span>Build budget ($)</span><input id="garageBudget" data-profile-field="budget" type="number" min="0" placeholder="3000"></label>
          <label><span>Primary goal</span><select id="garagePrimaryGoal" data-profile-field="primaryGoal"><option value="balanced">Balanced street</option><option value="reliability">Reliability / restore</option><option value="power">Power</option><option value="handling">Handling</option><option value="track">Track</option><option value="budget">Budget</option></select></label>
          <label><span>Target power increase (hp)</span><input id="garageTargetPower" data-profile-field="targetPower" type="number" min="0" placeholder="100"></label>
          <label class="full"><span>Current modifications</span><textarea id="garageCurrentMods" data-profile-field="currentMods" rows="3" placeholder="Suspension, wheels, intake, tune, brakes, engine swap, coding…"></textarea></label>
          <label class="full"><span>History</span><textarea id="garageHistory" data-profile-field="history" rows="3" placeholder="Ownership history, previous repairs, accidents, known work…"></textarea></label>
          <label class="full"><span>Current problems / weak points</span><textarea id="garageProblems" data-profile-field="problems" rows="3" placeholder="Leaks, codes, noises, overheating, worn bushings, cosmetic issues…"></textarea></label>
          <label class="full"><span>What you like about it</span><textarea id="garageLikes" data-profile-field="likes" rows="2" placeholder="Steering feel, ride, sound, simplicity…"></textarea></label>
          <label class="full"><span>What you do not like</span><textarea id="garageDislikes" data-profile-field="dislikes" rows="2" placeholder="Too soft, too loud, slow response, poor seats…"></textarea></label>
          <label class="full"><span>Build goal in your own words</span><textarea id="garageBuildGoals" data-profile-field="buildGoals" rows="3" placeholder="Example: I want about 100 more hp reliably and on a budget, while keeping it comfortable enough for road trips."></textarea></label>
        </div>
        <div class="garage-preferences">
          <label><span>Reliability priority (1–5)</span><select id="garageReliabilityPriority" data-profile-field="reliabilityPriority"><option>1</option><option>2</option><option>3</option><option>4</option><option selected>5</option></select></label>
          <label><span>Comfort priority (1–5)</span><select id="garageComfortPriority" data-profile-field="comfortPriority"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label>
          <label><span>Noise tolerance (1–5)</span><select id="garageNoiseTolerance" data-profile-field="noiseTolerance"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label>
        </div>
      </section>
      <section class="garage-card">
        <div class="garage-card-head"><div><span class="eyebrow">Maintenance tracker</span><h2>Service plan and history</h2><p>Intervals, fluids and capacities are intentionally blank until sourced for the exact application.</p></div><div class="garage-page-actions"><button id="seedMaintenanceButton" class="button secondary small" type="button">Add common checklist</button><button id="addMaintenanceButton" class="button primary small" type="button">Add item</button></div></div>
        <div id="maintenanceList" class="maintenance-list"></div>
      </section>
      <section class="garage-card">
        <div class="garage-card-head"><div><span class="eyebrow">Diagnostics</span><h2>Code history bank</h2><p>Keep recurring and resolved codes tied to mileage and repair history.</p></div></div>
        <div class="garage-inline-form">
          <label><span>Code</span><input id="codeValue" placeholder="P0171"></label><label><span>Date</span><input id="codeDate" type="date"></label><label><span>Mileage</span><input id="codeMileage" type="number" min="0"></label><label class="wide"><span>Description</span><input id="codeDescription" placeholder="Lean condition bank 1"></label><label class="wide"><span>Resolution</span><input id="codeResolution" placeholder="Smoke test found intake leak"></label><button id="addCodeButton" class="button primary" type="button">Add code</button>
        </div>
        <div id="codeHistory" class="history-list"></div>
      </section>
      <section class="garage-card">
        <div class="garage-card-head"><div><span class="eyebrow">Receipts and purchases</span><h2>Maintenance purchase log</h2><p>Email and scanned receipt ingestion are roadmap items; the first prototype stores normalized receipt metadata.</p></div></div>
        <div class="garage-inline-form">
          <label><span>Vendor</span><input id="receiptVendor" placeholder="FCP Euro"></label><label><span>Date</span><input id="receiptDate" type="date"></label><label><span>Amount ($)</span><input id="receiptAmount" type="number" min="0" step="0.01"></label><label><span>Category</span><input id="receiptCategory" placeholder="Cooling service"></label><label class="wide"><span>Notes</span><input id="receiptNotes" placeholder="Water pump, thermostat, hoses…"></label><button id="addReceiptButton" class="button primary" type="button">Add receipt</button>
        </div>
        <div id="receiptHistory" class="history-list"></div>
      </section>
    </div>
    <aside class="garage-side-column">
      <section class="garage-card">
        <div class="garage-card-head"><div><span class="eyebrow">Vehicle photos</span><h3>Actual car</h3></div></div>
        <div id="garagePhotos" class="garage-photos"></div>
        <label class="garage-upload"><input id="garagePhotoInput" type="file" accept="image/*" multiple></label>
        <p class="garage-note">Prototype storage is browser-local, so images are compressed and limited to four. Account-backed media storage comes later.</p>
      </section>
      <section class="garage-card garage-context-card">
        <span class="eyebrow">Build planner input</span><h3>Recommendation context</h3><div id="garageRecommendationSummary" class="garage-context-summary"></div>
        <div class="garage-context-actions"><button id="applyGarageContext" class="button primary" type="button">Apply goal to parts catalog</button></div>
        <p class="garage-note">The current button only applies the structured goal to deterministic catalog sorting. Full AI build generation will consume the complete context after performance/prerequisite evidence is added.</p>
        <details><summary>Developer context preview</summary><pre id="garageContextPreview" class="garage-context-preview"></pre></details>
      </section>
      <section class="garage-card"><span class="eyebrow">Next garage stages</span><h3>Already in the roadmap</h3><ul class="garage-roadmap-list"><li>sourced OEM intervals, fluids and capacities</li><li>receipt image/PDF + email imports</li><li>cross-make interchange groups</li><li>goal-generated build sheets</li><li>community/forum consensus</li><li>used listings and local shops</li></ul></section>
    </aside>
  </div>`;
main.appendChild(section);
const script=document.createElement('script');script.src='garage.js';script.async=false;document.body.appendChild(script);
})();
