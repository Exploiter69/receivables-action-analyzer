import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ACTIONS, analyzeRows, summarize } from "./engine.js";

function readFixture() {
  const text = fs.readFileSync(new URL("./fixtures/stress-100.csv", import.meta.url), "utf8")
    .split(/\r?\n/).filter(line => line && !line.startsWith("#")).join("\n");
  const lines = text.split("\n");
  const headers = lines.shift().split(",");
  return lines.map(line => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h,i)=>[h, values[i] ?? ""]));
  });
}

test("100-row stress fixture stays deterministic and safe", () => {
  const rows = readFixture();
  const today = new Date(2026, 8, 18);
  const results = analyzeRows(rows, { today, highValue: 500000 });
  const s = summarize(results);

  assert.equal(rows.length, 100);
  assert.equal(results.length, 100);
  assert.equal(s.dataIssues, 6);
  assert.equal(s.validRows, 94);

  const by = invoice => results.find(r => r.invoice === invoice);
  assert.equal(by("ST-066").action, ACTIONS.FINANCE);
  assert.equal(by("ST-066").financingCandidate, true);
  assert.equal(by("ST-056").action, ACTIONS.RECOVERY);
  assert.equal(by("ST-056").recoveryReady, true);
  assert.equal(by("ST-076").action, ACTIONS.FIX_EVIDENCE);
  assert.equal(by("ST-086").action, ACTIONS.FIX_EVIDENCE);
  assert.equal(by("ST-093").dataIssue, false);
  assert.equal(by("ST-094").dataIssue, true);
  assert.equal(by("ST-097").action, ACTIONS.FIX_EVIDENCE);
  assert.equal(results.find(r => r.invoice === "ST-095" && r.isDuplicate).dataIssue, true);
  assert.equal(results.find(r => r.invoice === "").action, ACTIONS.DATA_ISSUE);
  assert.equal(results.find(r => r.invoice === "ST-100").action, ACTIONS.DATA_ISSUE);

  assert.equal(s.actions[ACTIONS.MONITOR], 20);
  assert.equal(s.actions[ACTIONS.CHASE], 21);
  assert.equal(s.actions[ACTIONS.ESCALATE], 15);
  assert.equal(s.actions[ACTIONS.RECOVERY], 12);
  assert.equal(s.actions[ACTIONS.FINANCE], 10);
  assert.equal(s.actions[ACTIONS.FIX_EVIDENCE], 16);
  assert.equal(s.actions[ACTIONS.DATA_ISSUE], 0);
});
