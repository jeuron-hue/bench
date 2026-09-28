// mutations.cjs  -  phase 6. Every entry breaks one rule on purpose, and at least one suite has
// to go red for it. Run: node mutations.cjs
//
// WHAT A SURVIVOR MEANS. Not that the mutation is unfair and not that the rule does not matter:
// it means the FIXTURE is loose, and the honest response is another assertion rather than a
// quieter mutation. Three survived the first run of this file and all three were real gaps in the
// new seam -- the v_load column contract, the write gate's roster refusal, and what the reorder
// RPCs actually do once they exist. All three were the kind that fail silently in the tool: a
// blank workload view, a leaver who can still write, a table that renumbers one row. The
// assertions that now kill them are marked in their suites as having been added here.
//
// It restores every file in a finally block, so an interrupted run does not leave a mutation on
// disk. Check `git status` after running it anyway; a mutation left behind would be a defect that
// passes its own suite.
const fs = require('fs');
const cp = require('child_process');
const ROOT = __dirname;   // run it from anywhere; it edits the files beside itself

const SUITES = [
  ['queue_checks', 'node queue_checks.cjs'],
  ['admin_checks', 'node admin_checks.cjs console.html'],
  ['sched_checks', 'node sched_checks.cjs'],
  ['sched_logic',  'node sched_logic.cjs'],
];

const M = [
  // ---- the five the brief names, for the new seam ----
  { id: 'M01', why: 'membership predicate ignores roster_until (schedule)',
    file: 'sched.html',
    find: '  if (!p || !p.roster_until) return true;\n  return d2n(p.roster_until) >= today0();',
    repl: '  if (!p || !p.roster_until) return true;\n  return true;' },

  { id: 'M02', why: 'membership predicate ignores roster_until (queue)',
    file: 'queue.html',
    find: '  if (!p || !p.roster_until) return true;\n  return String(p.roster_until).slice(0,10) >= sgtToday();',
    repl: '  if (!p || !p.roster_until) return true;\n  return true;' },

  { id: 'M03', why: 'owner picker offers a departed person (queue claim/edit/reassign)',
    file: 'queue.html',
    find: '    if (!isOn && c !== selected) return;',
    repl: '    if (false && c !== selected) return;' },

  { id: 'M04', why: 'owner picker offers a departed person (console roster dropdowns)',
    file: 'console.html',
    find: '    if (!notLeaving(p) && c !== selected) return;',
    repl: '    if (false && c !== selected) return;' },

  { id: 'M05', why: 'a solo-held task does not fall to the unassigned bubble',
    file: 'sched.html',
    find: '    if (code === UNOWNED ? own.length > 0 : own.indexOf(code) < 0) return;',
    repl: '    if (code === UNOWNED ? true : own.indexOf(code) < 0) return;' },

  { id: 'M06', why: 'v_load emits hours instead of share',
    file: 'core.js',
    find: "        out.push({ source: 'task', id: it.id, person_code: code, day: d,\n                   share: share, label: it.title });",
    repl: "        out.push({ source: 'task', id: it.id, person_code: code, day: d,\n                   hours: it.effort_hours == null ? 8 : it.effort_hours, label: it.title });" },

  { id: 'M07', why: 'the shared LOT_COLS constant is bypassed by an inline copy',
    file: 'core.js',
    find: "  lots:           { from: 'lots',        cols: LOT_COLS, order: [['product'], ['seq']] },",
    repl: "  lots:           { from: 'lots',        cols: ['id','lot_number','product','year','seq','lot_type','purpose','is_use_test','lab_report_number','remarks','reserved_by','reserved_at','d1','d2','d3','experiment_start','experiment_end','frozen'], order: [['product'], ['seq']] }," },

  { id: 'M08', why: 'the shared LR_COLS constant is bypassed by an inline copy',
    file: 'core.js',
    find: "  labReports:     { from: 'lab_reports', cols: LR_COLS,",
    repl: "  labReports:     { from: 'lab_reports', cols: ['id','lr_number','seq','year','product','revision','lr_type','subject','report_date','created_by','created_at','lr_display','standalone']," },

  // ---- the seam more broadly ----
  { id: 'M09', why: 'the write gate stops refusing a leaver',
    file: 'core.js',
    find: "  if (!onRoster(p)) return 'You are no longer on the roster.';",
    repl: "  if (false) return 'You are no longer on the roster.';" },

  { id: 'M10', why: 'the clock is unpinned and reads the wall clock',
    file: 'core.js',
    find: 'function now()   { return new Date(PINNED_MS); }',
    repl: 'function now()   { return new Date(); }' },

  { id: 'M11', why: 'a reorder RPC renumbers only the row it was given',
    file: 'core.js',
    find: '    if (at >= 0) r.sort_order = at + 1;',
    repl: '    if (at === 0) r.sort_order = 1;' },

  { id: 'M12', why: 'gridAbsences drops its category filter and returns every v_grid row',
    file: 'core.js',
    find: "                    eq: ['category', 'absence'] },",
    repl: '                     },' },

  // ---- the pages' own rules ----
  { id: 'M13', why: 'lateness ignores the hard deadline and reads end_date alone',
    file: 'sched.html',
    find: 'function dbLate(t){ const t0 = today0(); return dbHardDates(t).some(d => d2n(d) < t0); }',
    repl: 'function dbLate(t){ const t0 = today0(); return t.end_date ? d2n(t.end_date) < t0 : false; }' },

  { id: 'M14', why: 'the open-items board seeds from teamActive alone, so a leaver keeps a row',
    file: 'queue.html',
    find: '  Object.keys(APP.teamActive).forEach(c => { if (c !== core.ADMIN_CODE && APP.teamOn[c]) tally[c] = { lo:0, ro:0 }; });',
    repl: '  Object.keys(APP.teamActive).forEach(c => { if (c !== core.ADMIN_CODE) tally[c] = { lo:0, ro:0 }; });' },

  { id: 'M15', why: 'the admin is offered as an assignable bench owner',
    file: 'queue.html',
    find: '    if (c === core.ADMIN_CODE && c !== selected) return;',
    repl: '    if (false && c !== selected) return;' },

  { id: 'M16', why: 'the dashboard partition lets a task land in two buckets',
    file: 'sched.html',
    find: '    if (dbLate(t)) { out.overdue.push(t); return; }',
    repl: '    if (dbLate(t)) { out.overdue.push(t); }' },

  // ---- the Viewing as picker and the three server rules it made reachable ----
  { id: 'M17', why: 'the Viewing as picker is ignored and every page signs in as its fallback',
    file: 'core.js',
    find: '  session = makeSession(viewingAs() || fallback || DEFAULT_USER);',
    repl: '  session = makeSession(fallback || DEFAULT_USER);' },

  { id: 'M18', why: 'the start gate stops enforcing needs_start',
    file: 'core.js',
    find: '  if (!s || !s.needs_start) return null;',
    repl: '  return null;' },

  { id: 'M19', why: 'an admin edit of a locked lot writes no admin_edit_log row',
    file: 'core.js',
    find: '  if (!res.error && adminLockEdit) {',
    repl: '  if (false) {' },

  { id: 'M20', why: 'posture 2 is refused its own absences again (the active gate is back)',
    file: 'core.js',
    find: '  var g = requireAbsenceWriter(a.p_person_code); if (g) return err(g);',
    repl: '  var g = requireWriter() || requireAbsenceWriter(a.p_person_code); if (g) return err(g);' },
];

function run(cmd) {
  try { cp.execSync(cmd, { cwd: ROOT, stdio: 'pipe' }); return true; }
  catch (e) { return false; }
}

const rows = [];
for (const m of M) {
  const path = ROOT + '/' + m.file;
  const orig = fs.readFileSync(path, 'utf8');
  if (!orig.includes(m.find)) {
    rows.push({ id: m.id, why: m.why, file: m.file, verdict: 'ANCHOR MISSING', killers: [] });
    continue;
  }
  fs.writeFileSync(path, orig.replace(m.find, m.repl), 'utf8');
  const killers = [];
  try {
    for (const [name, cmd] of SUITES) if (!run(cmd)) killers.push(name);
  } finally {
    fs.writeFileSync(path, orig, 'utf8');
  }
  rows.push({ id: m.id, why: m.why, file: m.file,
              verdict: killers.length ? 'killed' : 'SURVIVED', killers });
}

const w = Math.max(...rows.map(r => r.why.length));
console.log('id   ' + 'mutation'.padEnd(w) + '  file            verdict   killed by');
console.log('-'.repeat(w + 58));
rows.forEach(r => {
  console.log(r.id + '  ' + r.why.padEnd(w) + '  ' + r.file.padEnd(14) + '  '
    + (r.verdict === 'killed' ? 'killed  ' : r.verdict.padEnd(8)) + '  ' + r.killers.join(', '));
});
const bad = rows.filter(r => r.verdict !== 'killed');
console.log('');
console.log(rows.length + ' mutations, ' + (rows.length - bad.length) + ' killed, ' + bad.length + ' survived');
if (bad.length) { console.log('SURVIVORS: ' + bad.map(r => r.id).join(', ')); process.exitCode = 1; }
