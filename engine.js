export const ACTIONS = Object.freeze({
  DATA_ISSUE: "Data issue",
  FIX_EVIDENCE: "Fix evidence",
  FINANCE: "Potential financing",
  CHASE: "Chase",
  ESCALATE: "Escalate",
  RECOVERY: "Prepare recovery",
  MONITOR: "Monitor"
});

const TRUE_VALUES = new Set(["yes","y","true","1","done","available","accepted"]);

export function isTrue(value) {
  return TRUE_VALUES.has(String(value ?? "").trim().toLowerCase());
}

export function parseAmount(value) {
  const raw = String(value ?? "").trim().replace(/[₹,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseDate(value) {
  const s = String(value ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    return date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(mo) - 1 && date.getUTCDate() === Number(d) ? date : null;
  }
  m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(mo) - 1 && date.getUTCDate() === Number(d) ? date : null;
}

export function daysOverdue(value, today = new Date()) {
  const due = parseDate(value);
  if (!due) return null;
  const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return Math.max(0, Math.floor((t - due) / 86400000));
}

function buyerIsInstitutional(type) {
  return new Set(["cpse","psu","government"]).has(String(type ?? "").trim().toLowerCase());
}

export function analyzeReceivable(row, options = {}) {
  const highValue = Number(options.highValue ?? 500000);
  const today = options.today ?? new Date();
  const invoice = String(row.invoice ?? "").trim();
  const buyer = String(row.buyer ?? "").trim();
  const amount = parseAmount(row.amount);
  const due = parseDate(row.due_date);
  const overdue = daysOverdue(row.due_date, today);
  const duplicate = Boolean(row.isDuplicate);

  const missing = [];
  if (!invoice) missing.push("invoice");
  if (amount === null) missing.push("amount");
  if (!buyer) missing.push("buyer");
  if (!due) missing.push("due date");
  if (duplicate) missing.push("duplicate invoice");

  if (missing.length) {
    return {
      ...row, invoice, buyer, amount: amount ?? 0, overdue: overdue ?? 0,
      dataIssue: true, isDuplicate: duplicate, missingEvidence: [],
      evidenceCompleteness: 0, dispute: false, financingCandidate: false,
      recoveryReady: false, action: ACTIONS.DATA_ISSUE, priority: "Low",
      priorityScore: 0, reason: "Resolve data issue before making a financial decision.",
      actionSteps: ["Correct the source data and re-import the invoice."]
    };
  }

  const evidenceFields = ["po","delivery_proof","invoice_proof","udyam"];
  const present = evidenceFields.filter(k => isTrue(row[k])).length;
  const missingEvidence = evidenceFields.filter(k => !isTrue(row[k]));
  const evidenceCompleteness = Math.round(present / evidenceFields.length * 100);
  const notes = String(row.notes ?? "");
  const dispute = /disput|reject|den(y|ied)|not received|shortage|quality|damage/i.test(notes);
  const institutional = buyerIsInstitutional(row.buyer_type);
  const accepted = isTrue(row.accepted);
  const financingCandidate = institutional && accepted && evidenceCompleteness >= 75 && !dispute;
  const recoveryReady = overdue > 90 && evidenceCompleteness >= 75 && accepted && !dispute;

  let action, reason, actionSteps;
  if (dispute || evidenceCompleteness < 75) {
    action = ACTIONS.FIX_EVIDENCE;
    reason = dispute
      ? "A dispute signal is present; resolve the issue and preserve supporting evidence before escalation."
      : `Evidence is only ${evidenceCompleteness}% complete.`;
    actionSteps = ["Identify the missing documents.", "Confirm delivery/acceptance status.", "Resolve or document any buyer dispute."];
  } else if (financingCandidate) {
    action = ACTIONS.FINANCE;
    reason = "Accepted institutional-buyer invoice with sufficient evidence; evaluate a cash-acceleration route.";
    actionSteps = ["Confirm the invoice is accepted and undisputed.", "Check available financing terms.", "Compare financing cost with the cash-flow need."];
  } else if (overdue > 90) {
    action = ACTIONS.RECOVERY;
    reason = `${overdue} days overdue with accepted invoice and strong evidence.`;
    actionSteps = ["Compile the invoice and evidence pack.", "Document prior collection attempts.", "Review the appropriate formal recovery route."];
  } else if (overdue >= 61) {
    action = ACTIONS.ESCALATE;
    reason = `${overdue} days overdue; normal chasing has become an escalation candidate.`;
    actionSteps = ["Review the latest buyer commitment.", "Escalate to the responsible decision-maker.", "Set a dated next follow-up."];
  } else if (overdue > 0) {
    action = ACTIONS.CHASE;
    reason = `${overdue} days overdue; collection follow-up is the next action.`;
    actionSteps = ["Contact the buyer with invoice details.", "Ask for a specific payment date.", "Record the response and next follow-up date."];
  } else {
    action = ACTIONS.MONITOR;
    reason = "Not overdue and no blocking issue is detected.";
    actionSteps = ["Monitor until the due date.", "Keep evidence complete.", "Act if payment risk changes."];
  }

  // Economic priority is deliberately transparent: money at stake + aging + how actionable
  // the recommended route is. It is a prioritization proxy, not a probability of recovery.
  // The old linear amount cap made every invoice above highValue look identical.
  const moneyAtStake = Math.min(35, Math.max(0, 15 + 10 * Math.log10(amount / 100000)));
  const agingPressure = Math.min(25, overdue / 7);
  const actionValue = {
    [ACTIONS.FINANCE]: 25,
    [ACTIONS.RECOVERY]: 24,
    [ACTIONS.ESCALATE]: 20,
    [ACTIONS.FIX_EVIDENCE]: 12,
    [ACTIONS.CHASE]: 15,
    [ACTIONS.MONITOR]: 5
  }[action] ?? 0;
  const evidenceReadiness = evidenceCompleteness * 0.10;
  const priorityScore = Math.min(100, Math.round(moneyAtStake + agingPressure + actionValue + evidenceReadiness));
  const priority = priorityScore >= 85 ? "Critical" : priorityScore >= 60 ? "High" : priorityScore >= 30 ? "Medium" : "Low";

  return {
    ...row, invoice, buyer, amount, overdue, dataIssue:false, isDuplicate:duplicate,
    missingEvidence, evidenceCompleteness, dispute, financingCandidate, recoveryReady,
    action, reason, actionSteps, priority, priorityScore
  };
}

export function analyzeRows(rows, options = {}) {
  const seen = new Set();
  return rows.map(row => {
    const key = String(row.invoice ?? "").trim().toLowerCase();
    const isDuplicate = Boolean(key && seen.has(key));
    if (key) seen.add(key);
    return analyzeReceivable({...row, isDuplicate}, options);
  });
}

export function summarize(results) {
  const valid = results.filter(r => !r.dataIssue);
  const sum = key => valid.reduce((n,r) => n + r[key], 0);
  const actions = Object.values(ACTIONS).reduce((acc,a) => {
    acc[a] = valid.filter(r => r.action === a).length;
    return acc;
  }, {});
  return {
    totalRows: results.length,
    dataIssues: results.filter(r => r.dataIssue).length,
    validRows: valid.length,
    outstanding: sum("amount"),
    overdue: valid.filter(r=>r.overdue>0).reduce((n,r)=>n+r.amount,0),
    financing: valid.filter(r=>r.financingCandidate).reduce((n,r)=>n+r.amount,0),
    recoveryReady: valid.filter(r=>r.recoveryReady).reduce((n,r)=>n+r.amount,0),
    actions
  };
}
