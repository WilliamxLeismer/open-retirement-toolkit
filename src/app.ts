import { compareSimulationResults } from "./analysis";
import { defaultScenario, validateScenario, type Scenario, type SimulationResult } from "./domain";
import { withoutStress } from "./engine/stress";
import { buildResultCsv } from "./report";
import { CURRENT_BACKUP_VERSION, migrateBackup } from "./scenario-schema";
import { deleteScenario, listScenarios, saveScenario } from "./storage";

type Field = { key: keyof Scenario; label: string; type?: "percent"; step?: string; help?: string };
const fields: Field[] = [
  {key:"currentAge",label:"Current age",step:"1"},
  {key:"retirementAge",label:"Retirement age",step:"1"},
  {key:"endAge",label:"Plan through age",step:"1"},
  {key:"startingBalance",label:"Starting portfolio",step:"1000"},
  {key:"annualContribution",label:"Annual contribution",step:"1000"},
  {key:"annualSpending",label:"Annual retirement spending",step:"1000"},
  {key:"annualRetirementIncome",label:"Annual retirement income",step:"1000"},
  {key:"expectedReturn",label:"Expected annual return",type:"percent",step:"0.1"},
  {key:"volatility",label:"Annual volatility",type:"percent",step:"0.1"},
  {key:"inflation",label:"Annual inflation",type:"percent",step:"0.1"},
  {key:"effectiveTaxRate",label:"Effective tax rate",type:"percent",step:"0.1"},
  {key:"taxableWithdrawalShare",label:"Taxable withdrawal share",type:"percent",step:"1"},
  {key:"trials",label:"Monte Carlo trials",step:"100"},
  {key:"seed",label:"Random seed",step:"1"}
];
const money = new Intl.NumberFormat(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0});
const pct = new Intl.NumberFormat(undefined,{style:"percent",maximumFractionDigits:1});
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));

export class App {
  private scenario = defaultScenario();
  private scenarios: Scenario[] = [];
  private result?: SimulationResult;
  private baselineResult?: SimulationResult;
  private saveTimer?: number;
  private runNumber = 0;

  constructor(private root: HTMLElement) {}

  async start() {
    this.scenarios = await listScenarios();
    if (this.scenarios[0]) this.scenario = this.scenarios[0];
    else await saveScenario(this.scenario);
    this.render();
    await this.run();
  }

  private render() {
    const errors = validateScenario(this.scenario);
    this.root.innerHTML = `
      <header class="topbar">
        <div><span class="eyebrow">Private by design</span><h1>Open Retirement Toolkit</h1></div>
        <div class="save-state" id="save-state" role="status">Saved on this device</div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="side-heading"><h2>Scenarios</h2><button id="new" class="icon-button" title="New scenario">+</button></div>
          <div id="scenario-list" class="scenario-list">
            ${this.scenarios.map(s => `<button class="scenario-item ${s.id===this.scenario.id?"active":""}" data-load="${s.id}"><strong>${escapeHtml(s.name)}</strong><span>Updated ${new Date(s.updatedAt).toLocaleDateString()}</span></button>`).join("")}
          </div>
          <div class="button-stack">
            <button id="duplicate">Duplicate current</button>
            <button id="compare">Compare two scenarios</button>
            <button id="delete" class="quiet danger">Delete current</button>
          </div>
          <hr/>
          <div class="button-stack">
            <button id="export">Export backup</button>
            <label class="button-label">Import backup<input id="import" type="file" accept="application/json"/></label>
          </div>
          <p class="privacy-note">No account. No analytics. Financial data stays in this browser unless you export it.</p>
        </aside>
        <main>
          <section class="card setup">
            <div class="section-title"><div><span class="eyebrow">Scenario setup</span><h2><input id="name" class="name-input" value="${escapeHtml(this.scenario.name)}" aria-label="Scenario name"/></h2></div>
              <select id="model" aria-label="Return model"><option value="normal" ${this.scenario.model==="normal"?"selected":""}>Normal Monte Carlo</option><option value="deterministic" ${this.scenario.model==="deterministic"?"selected":""}>Deterministic</option></select>
            </div>
            <div class="field-grid">${fields.map(field => {
              const raw = this.scenario[field.key] as number;
              const value = field.type==="percent" ? raw*100 : raw;
              return `<label><span>${field.label}</span><input data-field="${field.key}" data-percent="${field.type==="percent"}" type="number" step="${field.step??"any"}" value="${value}"/></label>`;
            }).join("")}</div>
            <fieldset class="stress-box">
              <legend>Additional stress overlay</legend>
              <label class="toggle"><input id="stress-enabled" type="checkbox" ${this.scenario.stress.enabled?"checked":""}/> Apply one fixed-age portfolio loss</label>
              <div class="stress-fields">
                <label><span>Event age</span><input id="stress-age" type="number" step="1" min="${this.scenario.currentAge}" max="${this.scenario.endAge-1}" value="${this.scenario.stress.age}" ${this.scenario.stress.enabled?"":"disabled"}/></label>
                <label><span>Portfolio loss</span><input id="stress-loss" type="number" step="1" min="0.1" max="100" value="${Math.abs(this.scenario.stress.loss*100)}" ${this.scenario.stress.enabled?"":"disabled"}/><span class="input-suffix">%</span></label>
              </div>
              <p class="assumption">This applies one additional hypothetical loss before that month’s cash flow. It has no assigned probability.</p>
            </fieldset>
            <div id="errors" class="errors" ${errors.length?"":"hidden"}>${errors.map(e=>`<div>${escapeHtml(e)}</div>`).join("")}</div>
            <button id="run" class="primary" ${errors.length?"disabled":""}>Run simulation</button>
          </section>
          <section class="card results" aria-live="polite">
            <div class="section-title"><div><span class="eyebrow">Results</span><h2>Portfolio outlook</h2></div><div class="actions"><button id="csv" ${this.result?"":"disabled"}>CSV</button><button id="print">Print</button></div></div>
            <div id="result-content">${this.result ? this.resultMarkup(this.result) : '<div class="loading">Calculating…</div>'}</div>
          </section>
          <section id="compare-panel" class="card" hidden></section>
        </main>
      </div>
      <footer>Educational planning software, not financial advice. <a href="https://github.com/WilliamxLeismer/open-retirement-toolkit">Source code</a> · AGPL-3.0</footer>`;
    this.bind();
  }

  private bind() {
    this.root.querySelectorAll<HTMLInputElement>("[data-field]").forEach(input => input.addEventListener("input", () => {
      const key = input.dataset.field as keyof Scenario;
      const parsed = Number(input.value) / (input.dataset.percent==="true" ? 100 : 1);
      (this.scenario as unknown as Record<string,unknown>)[key] = parsed;
      this.changed();
    }));
    this.root.querySelector<HTMLInputElement>("#name")?.addEventListener("input", e => {
      this.scenario.name = (e.target as HTMLInputElement).value;
      this.changed(false);
    });
    this.root.querySelector<HTMLSelectElement>("#model")?.addEventListener("change", e => {
      this.scenario.model = (e.target as HTMLSelectElement).value as Scenario["model"];
      this.changed();
    });
    this.root.querySelector<HTMLInputElement>("#stress-enabled")?.addEventListener("change", e => {
      this.scenario.stress.enabled = (e.target as HTMLInputElement).checked;
      this.root.querySelectorAll<HTMLInputElement>("#stress-age,#stress-loss").forEach(input => input.disabled = !this.scenario.stress.enabled);
      this.changed();
    });
    this.root.querySelector<HTMLInputElement>("#stress-age")?.addEventListener("input", e => {
      this.scenario.stress.age = Number((e.target as HTMLInputElement).value);
      this.changed();
    });
    this.root.querySelector<HTMLInputElement>("#stress-loss")?.addEventListener("input", e => {
      this.scenario.stress.loss = -Number((e.target as HTMLInputElement).value) / 100;
      this.changed();
    });
    this.root.querySelector("#run")?.addEventListener("click", () => this.run());
    this.root.querySelector("#new")?.addEventListener("click", () => this.createNew());
    this.root.querySelector("#duplicate")?.addEventListener("click", () => this.duplicate());
    this.root.querySelector("#delete")?.addEventListener("click", () => this.remove());
    this.root.querySelector("#export")?.addEventListener("click", () => this.exportBackup());
    this.root.querySelector<HTMLInputElement>("#import")?.addEventListener("change", e => this.importBackup((e.target as HTMLInputElement).files?.[0]));
    this.root.querySelector("#csv")?.addEventListener("click", () => this.exportCsv());
    this.root.querySelector("#print")?.addEventListener("click", () => window.print());
    this.root.querySelector("#compare")?.addEventListener("click", () => this.showCompare());
    this.root.querySelectorAll<HTMLElement>("[data-load]").forEach(button => button.addEventListener("click", () => this.load(button.dataset.load!)));
  }

  private changed(run = true) {
    this.scenario.updatedAt = new Date().toISOString();
    const state = this.root.querySelector("#save-state");
    if (state) state.textContent = "Saving…";
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(async () => {
      await saveScenario(this.scenario);
      this.scenarios = await listScenarios();
      if (state) state.textContent = "Saved on this device";
    }, 350);
    const errors = validateScenario(this.scenario);
    const box = this.root.querySelector<HTMLElement>("#errors");
    if (box) {
      box.hidden = errors.length===0;
      box.innerHTML = errors.map(escapeHtml).join("<br>");
    }
    const runButton = this.root.querySelector<HTMLButtonElement>("#run");
    if (runButton) runButton.disabled = errors.length>0;
    if (run && !errors.length) window.setTimeout(() => this.run(), 300);
  }

  private runWorker(input: Scenario): Promise<SimulationResult> {
    return new Promise((resolve,reject) => {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {type:"module"});
      worker.onmessage = event => { worker.terminate(); event.data.ok ? resolve(event.data.result) : reject(new Error(event.data.error)); };
      worker.onerror = event => { worker.terminate(); reject(new Error(event.message)); };
      worker.postMessage(input);
    });
  }

  private async run() {
    if (validateScenario(this.scenario).length) return;
    const currentRun = ++this.runNumber;
    const content = this.root.querySelector("#result-content");
    if (content) content.innerHTML = '<div class="loading">Running simulation…</div>';
    try {
      const stressedScenario = { ...this.scenario, stress: { ...this.scenario.stress } };
      const [result, baseline] = await Promise.all([
        this.runWorker(stressedScenario),
        stressedScenario.stress.enabled ? this.runWorker(withoutStress(stressedScenario)) : Promise.resolve(undefined)
      ]);
      if (currentRun !== this.runNumber) return;
      this.result = result;
      this.baselineResult = baseline;
      if (content) content.innerHTML = this.resultMarkup(result, baseline);
      const csv = this.root.querySelector<HTMLButtonElement>("#csv");
      if (csv) csv.disabled = false;
    } catch (error) {
      if (content) content.innerHTML = `<div class="errors">${escapeHtml(error instanceof Error?error.message:"Simulation failed.")}</div>`;
    }
  }

  private resultMarkup(result: SimulationResult, baseline?: SimulationResult) {
    const width=760,height=260,pad=34;
    const max=Math.max(1,...result.points.map(p=>p.p90));
    const x=(i:number)=>pad+i*(width-pad*2)/Math.max(1,result.points.length-1);
    const y=(v:number)=>height-pad-v*(height-pad*2)/max;
    const path=(key:"p10"|"p50"|"p90")=>result.points.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    const comparison = baseline ? compareSimulationResults(baseline, result) : undefined;
    const stressMarkup = comparison ? `<section class="stress-comparison"><h3>Additional stress overlay</h3><p>One ${pct.format(Math.abs(this.scenario.stress.loss))} portfolio loss at age ${this.scenario.stress.age}. This is a hypothetical scenario, not an event probability.</p><div class="metrics"><div><span>Baseline success</span><strong>${pct.format(comparison.baselineSuccessRate)}</strong></div><div><span>Stressed success</span><strong>${pct.format(comparison.stressedSuccessRate)}</strong></div><div><span>Success-rate change</span><strong>${pct.format(comparison.successRateDelta)}</strong></div></div></section>` : "";
    return `<div class="metrics"><div><span>Funds last through plan</span><strong>${pct.format(result.successRate)}</strong></div><div><span>Median ending balance</span><strong>${money.format(result.endingMedian)}</strong></div><div><span>Model runs</span><strong>${result.trials.toLocaleString()}</strong></div></div>
      <p class="assumption">Conditional estimate using the inputs and model above. Engine ${result.engineVersion}. It is not a promise or probability about the real world.</p>
      ${stressMarkup}<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Projected portfolio percentiles by age">
        <line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" class="axis"/>
        <path d="${path("p90")}" class="line high"/><path d="${path("p50")}" class="line median"/><path d="${path("p10")}" class="line low"/>
        <text x="${pad}" y="${height-8}">Age ${result.points[0].age}</text><text x="${width-pad}" y="${height-8}" text-anchor="end">Age ${result.points.at(-1)?.age}</text>
      </svg>
      <div class="legend"><span class="p90">90th percentile</span><span class="p50">Median</span><span class="p10">10th percentile</span></div>
      <details><summary>View annual values</summary><div class="table-wrap"><table><thead><tr><th>Age</th><th>10th percentile</th><th>Median</th><th>90th percentile</th></tr></thead><tbody>${result.points.map(p=>`<tr><td>${p.age}</td><td>${money.format(p.p10)}</td><td>${money.format(p.p50)}</td><td>${money.format(p.p90)}</td></tr>`).join("")}</tbody></table></div></details>`;
  }

  private async refresh(select?: Scenario) {
    this.scenarios=await listScenarios();
    if (select) this.scenario=select;
    this.result=undefined;
    this.baselineResult=undefined;
    this.render();
    await this.run();
  }
  private async createNew() { const s=defaultScenario(); await saveScenario(s); await this.refresh(s); }
  private async duplicate() { const s={...this.scenario,id:crypto.randomUUID(),name:this.scenario.name+" copy",updatedAt:new Date().toISOString()}; await saveScenario(s); await this.refresh(s); }
  private async load(id:string) { const s=this.scenarios.find(item=>item.id===id); if(s) await this.refresh(s); }
  private async remove() {
    if (!confirm(`Delete "${this.scenario.name}" from this device?`)) return;
    await deleteScenario(this.scenario.id);
    const remaining=await listScenarios();
    const next=remaining[0]??defaultScenario();
    if(!remaining.length) await saveScenario(next);
    await this.refresh(next);
  }
  private download(name:string,content:string,type:string) {
    const url=URL.createObjectURL(new Blob([content],{type}));
    const a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
  }
  private exportBackup() { this.download("open-retirement-toolkit-backup.json",JSON.stringify({version:CURRENT_BACKUP_VERSION,exportedAt:new Date().toISOString(),scenarios:this.scenarios},null,2),"application/json"); }
  private async importBackup(file?:File) {
    if(!file) return;
    try {
      const items=migrateBackup(JSON.parse(await file.text()));
      for(const item of items) await saveScenario({...item,updatedAt:new Date().toISOString()});
      await this.refresh(items[0]);
    } catch(error) { alert(error instanceof Error?error.message:"Could not import backup."); }
  }
  private exportCsv() {
    if(!this.result)return;
    const csv=buildResultCsv(this.scenario,this.result,this.baselineResult);
    this.download(this.scenario.name.replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".csv",csv,"text/csv");
  }
  private async showCompare() {
    if(this.scenarios.length<2){alert("Create or duplicate another scenario first.");return;}
    const other=this.scenarios.find(s=>s.id!==this.scenario.id)!;
    const panel=this.root.querySelector<HTMLElement>("#compare-panel");
    if(!panel)return;
    panel.hidden=false; panel.innerHTML="<h2>Comparing scenarios…</h2>";
    const [a,b]=await Promise.all([this.runWorker(this.scenario),this.runWorker(other)]);
    panel.innerHTML=`<span class="eyebrow">Quick comparison</span><h2>${escapeHtml(this.scenario.name)} vs. ${escapeHtml(other.name)}</h2><div class="metrics"><div><span>${escapeHtml(this.scenario.name)} success</span><strong>${pct.format(a.successRate)}</strong></div><div><span>${escapeHtml(other.name)} success</span><strong>${pct.format(b.successRate)}</strong></div><div><span>Median ending difference</span><strong>${money.format(a.endingMedian-b.endingMedian)}</strong></div></div><p class="assumption">This first comparison uses the current scenario and the most recently updated alternative.</p>`;
    panel.scrollIntoView({behavior:"smooth"});
  }
}
