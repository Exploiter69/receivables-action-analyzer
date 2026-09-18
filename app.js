import { ACTIONS, analyzeRows, summarize } from "./engine.js";

const demo = [
  ["INV-001","420000","2026-09-25","ABC Components","open","no","yes","yes","yes","yes","private",""],
  ["INV-002","950000","2026-08-01","BHEL","accepted","yes","yes","yes","yes","yes","cpse","Accepted invoice"],
  ["INV-003","560000","2026-03-20","Dharma Engineering","overdue","yes","yes","no","yes","yes","private",""],
  ["INV-004","890000","2026-06-03","Auto Parts Ltd","overdue","yes","yes","no","yes","yes","private","quality dispute"],
  ["INV-005","1580000","2026-04-01","IOCL","overdue","yes","yes","yes","yes","yes","cpse",""],
  ["INV-006","","2026-07-01","IOCL","overdue","yes","yes","yes","yes","yes","cpse",""],
  ["INV-007","550000","2026-06-24","","overdue","yes","yes","yes","yes","yes","private",""],
  ["INV-002","950000","2026-08-01","BHEL","accepted","yes","yes","yes","yes","yes","cpse","duplicate"]
];
const headers=["invoice","amount","due_date","buyer","status","accepted","po","delivery_proof","invoice_proof","udyam","buyer_type","notes"];
const requiredHeaders=["invoice","amount","due_date","buyer"];
const demoCsv=[headers.join(","),...demo.map(r=>r.join(","))].join("\n");
let results=[]; let state=new Map();
const $=id=>document.getElementById(id);
const money=n=>"₹"+Math.round(n).toLocaleString("en-IN");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const badgeClass=a=>a===ACTIONS.DATA_ISSUE?"red":[ACTIONS.FIX_EVIDENCE,ACTIONS.CHASE].includes(a)?"amber":a===ACTIONS.FINANCE?"blue":a===ACTIONS.MONITOR?"green":"purple";

function parseCSV(text){
  const lines=[];let row=[],value="",quote=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
    if(c==='"'&&n==='"'){value+='"';i++;continue} if(c==='"'){quote=!quote;continue}
    if(c===','&&!quote){row.push(value.trim());value="";continue}
    if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&n==='\n')i++;row.push(value.trim());value="";if(row.some(Boolean))lines.push(row);row=[];continue}
    value+=c;
  }
  if(value||row.length){row.push(value.trim());if(row.some(Boolean))lines.push(row)}
  if(!lines.length)return [];
  const hs=lines.shift().map(h=>h.toLowerCase().trim().replace(/\s+/g,"_"));
  return lines.map(r=>Object.fromEntries(hs.map((h,i)=>[h,r[i]??""])));
}
function demoObjects(){return demo.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));}
function setStatus(message,type=""){
  const el=$("importStatus");
  el.textContent=message;
  el.className="status"+(type?" "+type:"");
}
function loadRows(rows){
  results=analyzeRows(rows,{today:new Date(),highValue:500000}).map((r,i)=>({...r,_rowId:String(i)}));
  state=new Map(results.map(r=>[r._rowId,"OPEN"])); render();
}
function render(){
  const s=summarize(results);
  $("kpis").innerHTML=[["Outstanding",money(s.outstanding)],["Overdue",money(s.overdue)],["Potential financing",money(s.financing)],["Recovery-ready",money(s.recoveryReady)]].map(([a,b])=>`<div class="kpi"><span>${a}</span><strong>${b}</strong></div>`).join("");
  const queue=results.filter(r=>!r.dataIssue).sort((a,b)=>b.priorityScore-a.priorityScore||b.amount-a.amount).slice(0,7);
  $("queue").innerHTML=queue.length?queue.map((r,i)=>card(r,i)).join(""):'<div class="empty">Import receivables to build the queue.</div>';
  $("focus").textContent=queue.length ? `Start with ${queue[0].invoice} — ${money(queue[0].amount)} at ${queue[0].overdue ? queue[0].overdue+" days overdue" : "not yet due"}. Recommended action: ${queue[0].action}.` : "Import receivables to generate today’s prioritized action queue.";
  $("all").innerHTML=results.length?table(results):'<div class="empty">No receivables loaded.</div>';
  $("issues").textContent=s.dataIssues+" data issues"; $("count").textContent=s.totalRows+" rows";
}
function card(r,i){
  return `<article class="action-card"><div class="rank">${i+1}</div><div class="action-main">
    <div class="row"><b>${esc(r.invoice)}</b><span class="priority ${r.priority.toLowerCase()}">${r.priority}</span><span class="badge ${badgeClass(r.action)}">${esc(r.action)}</span></div>
    <div class="buyer">${esc(r.buyer)||"Unknown buyer"} · ${money(r.amount)} · ${r.overdue?r.overdue+"d overdue":"Not overdue"}</div>
    <p>${esc(r.reason)}</p><div class="why"><b>Do next:</b> ${esc(r.actionSteps[0])}</div>
    <div class="card-actions"><button data-key="${r._rowId}" data-state="IN PROGRESS" class="smallbtn">Start</button><button data-key="${r._rowId}" data-state="DONE" class="smallbtn secondary">Done</button><button data-detail="${r._rowId}" class="smallbtn secondary">Details</button></div>
  </div></article>`;
}
function table(rows){
  return `<div class="table-wrap"><table><thead><tr><th>Priority</th><th>Invoice</th><th>Buyer</th><th>Amount</th><th>Age</th><th>Action</th><th>Evidence</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr data-detail="${r._rowId}" tabindex="0" title="Open details"><td><span class="priority ${r.priority.toLowerCase()}">${r.priority}</span></td><td><b>${esc(r.invoice)||"—"}</b></td><td>${esc(r.buyer)||"—"}</td><td>${money(r.amount)}</td><td>${r.dataIssue?"—":r.overdue+"d"}</td><td><span class="badge ${badgeClass(r.action)}">${esc(r.action)}</span></td><td>${r.dataIssue?"—":r.evidenceCompleteness+"%"}</td><td>${r.dataIssue?"DATA ISSUE":state.get(r._rowId)||"OPEN"}</td></tr>`).join("")}</tbody></table></div>`;
}
$("csv").value=demoCsv;
$("analyze").onclick=()=>{
  const text=$("csv").value.trim();
  if(!text){ setStatus("Nothing to analyze. Paste a CSV or load the demo.","error"); results=[]; state.clear(); render(); return; }
  const rows=parseCSV(text);
  if(!rows.length){ setStatus("No data rows found. Check the CSV format.","error"); return; }
  const missingHeaders=requiredHeaders.filter(h=>!(Object.keys(rows[0]).includes(h)));
  if(missingHeaders.length){ setStatus("Missing required columns: "+missingHeaders.join(", ")+".","error"); return; }
  loadRows(rows);
  const s=summarize(results);
  setStatus(`Analyzed ${s.totalRows} rows: ${s.validRows} valid, ${s.dataIssues} data issues.`,s.dataIssues?"warning":"success");
};
$("sample").onclick=()=>{$("csv").value=demoCsv;loadRows(demoObjects());setStatus("Demo loaded. Review the deliberate data-quality and evidence cases.","success")};
$("clear").onclick=()=>{$("csv").value="";results=[];state.clear();setStatus("Cleared. No receivables are loaded.","");render();};
function detail(r){$("detailContent").innerHTML=`<p class="eyebrow">RECEIVABLE DETAIL</p><h2>${esc(r.invoice)||"Unnamed invoice"}</h2><p class="detail-sub">${esc(r.buyer)||"Unknown buyer"} · ${money(r.amount)}</p><div class="detail-grid"><div><span>Recommended action</span><strong>${esc(r.action)}</strong></div><div><span>Priority</span><strong>${esc(r.priority)} · ${r.priorityScore}/100</strong></div><div><span>Age</span><strong>${r.dataIssue?"Data issue":r.overdue+" days overdue"}</strong></div><div><span>Evidence</span><strong>${r.dataIssue?"Unavailable":r.evidenceCompleteness+"%"}</strong></div></div><h3>Why</h3><p>${esc(r.reason)}</p><h3>Do next</h3><ol>${r.actionSteps.map(x=>`<li>${esc(x)}</li>`).join("")}</ol><h3>Signals</h3><p class="signals">${r.dataIssue?"Data issue blocks financial recommendation.":`Accepted: ${r.accepted?"Yes":"No"} · Dispute: ${r.dispute?"Yes":"No"} · Financing candidate: ${r.financingCandidate?"Yes":"No"} · Recovery-ready: ${r.recoveryReady?"Yes":"No"}`}</p>`;$("detail").showModal();}
$("queue").addEventListener("click",e=>{
  const b=e.target.closest("button");
  if(!b)return;
  if(b.dataset.detail){ const r=results.find(x=>x._rowId===b.dataset.detail); if(r) detail(r); return; }
  state.set(b.dataset.key,b.dataset.state); render();
});
$("all").addEventListener("click",e=>{
  const row=e.target.closest("tr[data-detail]");
  if(row){ const r=results.find(x=>x._rowId===row.dataset.detail); if(r) detail(r); }
});
loadRows(demoObjects());

$("closeDetail").onclick=()=>$("detail").close();
