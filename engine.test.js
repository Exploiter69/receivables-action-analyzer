import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, analyzeReceivable, analyzeRows, summarize } from "./engine.js";

const today = new Date(2026, 8, 18);
const base = {
  invoice:"INV-X", amount:"1000000", due_date:"2026-08-01", buyer:"Buyer",
  accepted:"yes", po:"yes", delivery_proof:"yes", invoice_proof:"yes", udyam:"yes",
  buyer_type:"private", notes:""
};

test("missing amount becomes a data issue and contributes zero", () => {
  const r = analyzeReceivable({...base, amount:""}, {today});
  assert.equal(r.action, ACTIONS.DATA_ISSUE);
  assert.equal(r.amount, 0);
  assert.equal(r.dataIssue, true);
});

test("invalid date becomes a data issue", () => {
  const r = analyzeReceivable({...base, due_date:"31-13-2026"}, {today});
  assert.equal(r.action, ACTIONS.DATA_ISSUE);
});

test("accepted institutional invoice remains a financing candidate", () => {
  const r = analyzeReceivable({...base, buyer:"BHEL", buyer_type:"cpse", due_date:"2026-08-01"}, {today});
  assert.equal(r.action, ACTIONS.FINANCE);
  assert.equal(r.financingCandidate, true);
});

test("dispute overrides financing", () => {
  const r = analyzeReceivable({...base, buyer_type:"cpse", notes:"quality dispute"}, {today});
  assert.equal(r.action, ACTIONS.FIX_EVIDENCE);
  assert.equal(r.financingCandidate, false);
});

test("missing evidence overrides recovery", () => {
  const r = analyzeReceivable({...base, due_date:"2026-03-01", delivery_proof:"no"}, {today});
  assert.equal(r.action, ACTIONS.FIX_EVIDENCE);
  assert.equal(r.recoveryReady, false);
});

test("strong accepted invoice over 90 days is recovery-ready", () => {
  const r = analyzeReceivable({...base, due_date:"2026-05-01"}, {today});
  assert.equal(r.action, ACTIONS.RECOVERY);
  assert.equal(r.recoveryReady, true);
});

test("duplicates are excluded from financial totals", () => {
  const rows = [
    {...base, invoice:"DUP-1"},
    {...base, invoice:"DUP-1"}
  ];
  const results = analyzeRows(rows, {today});
  const s = summarize(results);
  assert.equal(results[1].dataIssue, true);
  assert.equal(s.outstanding, 1000000);
});

test("date parser accepts ISO and Indian DD-MM-YYYY and rejects impossible dates", () => {
  assert.equal(analyzeReceivable({...base, due_date:"01-08-2026"}, {today}).dataIssue, false);
  assert.equal(analyzeReceivable({...base, due_date:"13-08-2026"}, {today}).dataIssue, false);
  assert.equal(analyzeReceivable({...base, due_date:"31-13-2026"}, {today}).dataIssue, true);
  assert.equal(analyzeReceivable({...base, due_date:"2026-08-01"}, {today}).dataIssue, false);
});
