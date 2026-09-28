#!/usr/bin/env node
/*
  queue_checks.cjs  -  run against the built file:  node queue_checks.cjs queue.html

  PORTED, not rewritten, alongside queue.html. Copied byte for byte from the original and
  then edited in place. What changed and why:

    - the roster fixtures moved onto the bench roster, code for code
    - the seam is core.js, so the RPC-surface check reads core.rpc and the read check
      reads the named registry rather than inline table selects
    - AUTH retargets onto core.js: the login SCREEN is gone, the auth SURFACE is not
    - BUILD CURRENCY is deleted outright, 16 assertions, because the feature is gone
    - one section is NEW: the shared column constants, section 12

  The 16 deleted assertions are the only ones lost. Everything else is the same assertion
  pointed at the same fact.

  ONE FILE, static and behavioural together. The stylesheet is lifted from the schedule
  tool and this page owns almost none of it, so a split would buy nothing.

  Argv IS honoured here, deliberately, and the same trap is still worth not reproducing:
  a harness that hardcodes its filename silently tests the clean file during a mutation run.
*/
const fs = require('fs');
// The page's own functions now reach core.now() and core.ADMIN_CODE, so the harness has to
// hold the real seam rather than a stub of it. Loading it here also means a change to the
// pinned clock or the admin code is felt by these assertions instead of silently ignored.
require('./seed.js'); require('./core.js');
const core = globalThis.core;
const path = process.argv[2] || 'queue.html';
const src = fs.readFileSync(path, 'utf8');
// Comments are prose. Fifth instance across the suite of a check firing on English that quoted
// the thing it was testing for, so the strip comes before anything counts.
const bare = src.replace(/<!--[\s\S]*?-->/g, '');
const js = src.match(/<script>\n([\s\S]*?)\n<\/script>\s*<\/body>/)[1];
const code = js.replace(/^\s*\/\/.*$/gm, '');

let fails = 0;
const ok  = m => console.log('  PASS  ' + m);
const bad = m => { fails++; console.log('  FAIL  ' + m); };
const is  = (got, want, m) => (got === want ? ok(m) : bad(m + '   got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)));

// Two shapes in this file: multi-line functions closing on a brace at column 0, and one-liners
// that never reach one. The schedule tool's grab only knows the first, because that file has no
// one-liners worth evaling. Try the single line first: a one-liner cannot contain a newline, so
// anchored to end-of-line cannot run past its own function.
// async counts. loadAll is the roster read and it is the first function this file wants.
const grab = n => {
  const one = js.match(new RegExp('^(?:async )?function ' + n + '\\([^\\n]*\\}$', 'm'));
  if (one) return one[0];
  const many = js.match(new RegExp('^(?:async )?function ' + n + '\\([\\s\\S]*?\\n\\}', 'm'));
  if (!many) throw new Error('not found: ' + n);
  return many[0];
};
const body = grab;

// ---------------------------------------------------------------- 1. assembly
console.log('\nASSEMBLY');
{
  const c = t => bare.split(t).length - 1;
  is(c('</html>'), 1, 'html closed once');
  is(c('</body>'), 1, 'body closed once');
  is(c('</script>'), 3, 'script closed three times (seed, core, inline)');
  try { new Function(js); ok('inline script parses (' + js.split('\n').length + ' lines)'); }
  catch (e) { bad('inline script: ' + e.message); }
}

// ---------------------------------------------------------------- 2. the version head line
// THE DEFECT THIS FILE WAS BORN FROM. The head line read v0.21 while the change history below it
// carried a v0.22 entry and the body carried v0.22's code. Third time the head-line rule has
// failed across the suite and the first that nothing caught, because this page had no checker.
//
// MECHANICAL, not a reminder. The rule is that the head line is the highest version the header
// mentions. Every entry beneath it describes a version that has already shipped, so a version
// named anywhere in the header and NOT reachable from the head line means the head line is stale.
// Works whichever direction the log runs: the schedule tool is newest-first, this is oldest-first.
console.log('\nVERSION HEAD');
{
  const header = (src.match(/<!--[\s\S]*?-->/) || [''])[0];
  const head = header.match(/Build state:\s*v(\d+)\.(\d+)(?:\.(\d+))?/);
  const key = m => (+m[1]) * 1e6 + (+m[2]) * 1e3 + (+(m[3] || 0));
  if (!head) { bad('no "Build state:" line in the header comment'); }
  else {
    const all = [...header.matchAll(/\bv(\d+)\.(\d+)(?:\.(\d+))?\b/g)];
    const top = all.reduce((a, m) => (key(m) > key(a) ? m : a), head);
    is(key(head), key(top),
       'the head line is the highest version the header names (head v' + head[1] + '.' + head[2]
       + (head[3] ? '.' + head[3] : '') + ', highest named v' + top[1] + '.' + top[2] + (top[3] ? '.' + top[3] : '') + ')');
  }
  // Was: pointed at PROD. There is no environment to point at now, so the assertion is
  // inverted rather than dropped - the fact worth holding is that nothing reaches out.
  // `code`, not `js`. COMMENTS ARE PROSE and the [REMOVED] note above the old CONFIG block
  // names ENVIRONMENTS and ACTIVE_ENV in English to say they are gone. Sixth instance in this
  // suite of a check firing on a sentence that quoted the thing it was testing for.
  is(/ACTIVE_ENV|ENVIRONMENTS|createClient/.test(code), false,
     'no environment config and no client construction: the seam is core.js');
  is(/https?:\/\//.test(code), false, 'and the script block contains no URL at all');
}

// ---------------------------------------------------------------- 3. harness
// Everything below runs the real functions out of the file. APP is a plain object here and every
// fixture sets what it needs, so a function reading state nobody set throws rather than passing.
let APP = {};
const esc = eval('(' + grab('esc').replace(/^function esc/, 'function') + ')');
eval(grab('sgtToday'));
eval(grab('onTeam')); eval(grab('codeOnTeam'));
eval(grab('lotLocked')); eval(grab('lrLocked')); eval(grab('lotLife'));
eval(grab('ownerOptions'));
eval(grab('lotRows')); eval(grab('lrRows'));
eval(grab('setLotFilter')); eval(grab('setLrFilter'));
eval(grab('filterTypeOptions')); eval(grab('stateOptions'));
eval(grab('canAct'));

// Dates are computed off the clock, never typed. A typed date expires into something that looks
// exactly like a regression, which cost admin_checks four assertions on 02/08/26.
const SGT = n => {
  // core.nowMs(), not Date.now(). The page's sgtToday() reads the pinned clock, so a harness
  // on the wall clock would drift away from the code it is testing the moment the day rolled.
  const d = new Date(core.nowMs() + n * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Singapore', year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
};
// renderLots and renderBoard write innerHTML into elements this file has no DOM for. Stub the two
// calls they make rather than skipping the functions: the seed is the thing worth testing and a
// source assertion would only prove the line was present, not that it counts what it should.
let painted = '';
global.document = { getElementById: () => ({ set innerHTML(v){ painted = v; }, get innerHTML(){ return painted; } }) };
eval(grab('renderBoard'));
// setLotFilter and setLrFilter each end by repainting their tab. Stubbed rather than evaled: the
// filter fixtures are about the state change and the row function, and pulling in two full table
// renders would drag half the file into the harness for nothing. This is the "a dependency added
// to an evaled function must be added to the harness" trap, and it fired here on the first run.
function renderLots(){ }
function renderLRs(){ }

// ---------------------------------------------------------------- 4. the roster load, three maps
// v0.22 built three maps off one roster read and they answer three different questions. The whole
// design depends on the last two being INDEPENDENT: a leaver is active=TRUE with a past date under
// the model admin.html writes, so anything reading active alone still offers them.
console.log('\nROSTER: THREE MAPS, AND TWO OF THEM ARE INDEPENDENT');
{
  const load = body('loadAll');
  is(/APP\.team\b/.test(load) && /APP\.teamActive\b/.test(load) && /APP\.teamOn\b/.test(load), true,
     'all three maps are built in loadAll');
  // ANCHORED ON THE WHOLE LINE, not on the substring. The first cut tested for
  // /APP\.team\[m\.code\] = m\.full_name;/ and a mutation prefixing it with `if (onTeam(m))`
  // survived, because a gated assignment still contains an ungated one. Filtering this map is the
  // single worst thing that could be done to this page: every frozen lot and signed LR would lose
  // the name beside its code, silently, on the morning after somebody's roster date passed.
  is(/\n\s*APP\.team\[m\.code\] = m\.full_name;/.test(load), true,
     'the name map takes EVERY code UNCONDITIONALLY: names on frozen rows must resolve forever');
  is(/if \(m\.active\) APP\.teamActive/.test(load), true, 'teamActive is gated on active alone');
  is(/if \(onTeam\(m\)\) APP\.teamOn/.test(load), true, 'teamOn is gated on onTeam alone');
  is(/if \(m\.active && onTeam\(m\)\)|onTeam\(m\) && m\.active/.test(load), false,
     'and neither is a widening of the other: no combined test builds either map');

  // The predicate itself. Inclusive of the last day, which is the whole point of a roster END.
  is(onTeam({ roster_until:null }), true, 'a null roster_until is a current member');
  is(onTeam({}), true, 'and so is a row that has no such column at all');
  is(onTeam({ roster_until:SGT(0) }), true, 'the date is their LAST day, so today still counts');
  is(onTeam({ roster_until:SGT(1) }), true, 'tomorrow counts');
  is(onTeam({ roster_until:SGT(-1) }), false, 'yesterday does not');
  is(onTeam(null), true, 'a missing row is not a leaver: unknown reads as on-team, never as gone');
  // THE SLICE IS DEFENSIVE, NOT LOAD-BEARING, and this assertion cannot prove otherwise. Removing
  // .slice(0,10) survives every fixture here and that is correct rather than a gap: comparing
  // 'YYYY-MM-DDTHH:MM' against 'YYYY-MM-DD' lexicographically is decided by the date prefix, and
  // where the prefixes are equal the longer string sorts higher, which is the same answer >=
  // gives on the sliced pair. An equivalent mutant. Recorded so nobody spends an hour writing a
  // fixture for a difference that does not exist, and kept because the slice still bounds a value
  // arriving in a shape nobody planned for.
  is(onTeam({ roster_until: SGT(0) + 'T23:59:59+08:00' }), true,
     'a timestamp where a date was expected still reads as their last day');

  APP = { team:{ MJD:'Marcus Devlin', CJR:'Callum Reyes' }, teamOn:{ MJD:true } };
  is(codeOnTeam('MJD'), true, 'a code on the roster reads on-team');
  is(codeOnTeam('CJR'), false, 'a code whose date has passed does not');
  is(codeOnTeam('ZZZ'), true, 'a code this page has never heard of reads ON-team, never silently hidden');
  is(codeOnTeam(''), true, 'and an empty code is not a person to hide either');
}

// ---------------------------------------------------------------- 5. lock rules
// The page MIRRORS the SQL; the server still enforces. A mirror that disagrees with the thing it
// reflects is worse than no mirror, because the row renders editable and the save is refused.
console.log('\nLOCK RULES  (UI mirror of the SQL, four disjuncts and no fifth)');
{
  const L = f => Object.assign({ frozen:false, is_use_test:false, d1:null, d2:null, d3:null,
                                 lab_report_number:null, experiment_start:null, experiment_end:null }, f);
  is(lotLocked(L({})), false, 'a bare open lot is not locked');
  is(lotLocked(L({ frozen:true })), true, 'frozen locks it outright');
  is(lotLocked(L({ is_use_test:true, d2:'2026-07-01' })), true, 'a use test locks at d2');
  is(lotLocked(L({ is_use_test:true, d1:'2026-07-01' })), false, 'but not at d1');
  is(lotLocked(L({ is_use_test:true, d3:'2026-07-01' })), false, 'and not at d3 alone, which cannot arrive first');
  is(lotLocked(L({ lab_report_number:'LR26024' })), true, 'a non-UT lot locks once it carries an LR');
  is(lotLocked(L({ is_use_test:true, lab_report_number:'LR26024' })), false,
     'a USE TEST lot does not, and that is not an oversight: it self-references its own number');
  is(lotLocked(L({ experiment_end:'2026-07-01' })), true, 'a non-UT lot locks at experiment end');
  is(lotLocked(L({ is_use_test:true, experiment_end:'2026-07-01' })), false, 'a UT lot does not');
  is(lotLocked(L({ experiment_start:'2026-07-01' })), false, 'starting is not finishing');

  is(lrLocked({ report_date:null }), false, 'an unsigned LR is open');
  is(lrLocked({ report_date:'2026-07-01' }), true, 'an approved one is locked, and that is the whole rule');
  is(lrLocked({}), false, 'a missing column is not a lock');

  // Three lives, and d3pending is the only one that is not simply locked-or-not.
  is(lotLife(L({})), 'open', 'an unlocked lot is open');
  is(lotLife(L({ is_use_test:true, d2:'2026-07-01' })), 'd3pending',
     'a locked use test with d2 and no d3 still has one field to go');
  is(lotLife(L({ is_use_test:true, d2:'2026-07-01', d3:'2026-07-08' })), 'frozen', 'and freezes once d3 lands');
  is(lotLife(L({ frozen:true })), 'frozen', 'an explicitly frozen lot is frozen, use test or not');
  is(lotLife(L({ lab_report_number:'LR26024' })), 'frozen', 'so is a locked non-UT lot');
}

// ---------------------------------------------------------------- 6. the board seed
// v0.22. The seed takes teamActive AND teamOn, and they are two separate tests. A posture-2
// trainee keeps a row because somebody can hold a lot they cannot currently edit. A leaver gets
// none, because a row reading 0 and 0 for somebody who has gone is noise, and a row reading 1 open
// lot for them is a problem the page gives no way to see.
console.log('\nBOARD SEED  (active AND on-roster, and HZO is not on the bench)');
{
  const lot = (id, by, f) => Object.assign({ id, reserved_by:by, frozen:false, is_use_test:false,
    d1:null, d2:null, d3:null, lab_report_number:null, experiment_start:null, experiment_end:null }, f || {});
  const lr = (id, by, date) => ({ id, created_by:by, report_date:date || null });
  const run = patch => { APP = Object.assign({
      team:{ HZO:'Helena Ostrow', MJD:'Marcus Devlin', IPB:'Ines Barbosa', CJR:'Callum Reyes', PYR:'Priya Raman' },
      teamActive:{ HZO:true, MJD:true, IPB:true, CJR:true, PYR:true },
      teamOn:{ HZO:true, MJD:true, IPB:true, PYR:true },   // CJR has left
      lots:[], lrs:[] }, patch || {}); painted = ''; renderBoard(); return painted; };

  const h = run({});
  is(/MJD/.test(h) && /IPB/.test(h) && /PYR/.test(h), true, 'every active on-roster member is seeded, at zero');
  is(/CJR/.test(h), false, 'a leaver gets no row, though their name still resolves everywhere else');
  is(/HZO/.test(h), false, 'and neither does the admin: the board is about the bench');

  // A posture-2 trainee is inactive and NOT a leaver. The two tests must not collapse into one.
  const p2 = run({ teamActive:{ MJD:true, IPB:true }, teamOn:{ MJD:true, IPB:true, PYR:true } });
  is(/PYR/.test(p2), false, 'inactive keeps somebody off the seed');
  const gone = run({ teamActive:{ MJD:true, IPB:true, PYR:true }, teamOn:{ MJD:true, IPB:true } });
  is(/PYR/.test(gone), false, 'and so does off-roster, independently');

  // The counts. OPEN only, and the lock functions are what decide, so the board and the row
  // colouring cannot disagree about what open means.
  const c = run({ lots:[lot(1,'MJD'), lot(2,'MJD'), lot(3,'MJD',{ frozen:true }), lot(4,'CJR')],
                  lrs:[lr(1,'MJD'), lr(2,'MJD','2026-07-01'), lr(3,'IPB')] });
  const cell = (code, n) => new RegExp('<td class="code">' + code + '</td><td>' + n + '</td>').test(c);
  is(cell('MJD', 2), true, 'two open lots counted, the frozen one not');
  is(/<td class="code">MJD<\/td><td>2<\/td><td>1<\/td>/.test(c), true, 'and one open LR, the approved one not');
  is(/<td class="code">IPB<\/td><td>0<\/td><td>1<\/td>/.test(c), true, 'a member with only an LR still reads correctly');
  is(/CJR/.test(c), false, 'the leaver holds an open lot and STILL gets no row: this is the known gap');

  // Sort: most open first, code order on a tie. A board that reorders itself between refreshes is
  // read as a data fault.
  const s = run({ lots:[lot(1,'PYR'), lot(2,'PYR'), lot(3,'MJD')] });
  is(s.indexOf('PYR') < s.indexOf('MJD'), true, 'the busiest row is first');
  is(s.indexOf('MJD') < s.indexOf('IPB'), true, 'and equal rows fall back to code order');

  is(/No active team members to show/.test(run({ teamActive:{}, teamOn:{} })), true,
     'an empty board says so rather than rendering an empty table');
}

// ---------------------------------------------------------------- 7. the owner dropdown
// THE ESCAPE IS THE HALF THAT MATTERS. Every exclusion carries `&& c !== selected`, so opening a
// row held by somebody excluded still shows who holds it. Without that the dropdown renders
// (none) and a save silently strips the owner off a row that has one.
console.log('\nOWNER DROPDOWN  (three exclusions, and each one has an escape)');
{
  APP = { team:{ HZO:'Helena Ostrow', MJD:'Marcus Devlin', IPB:'Ines Barbosa', CJR:'Callum Reyes', PYR:'Priya Raman' },
          teamActive:{ HZO:true, MJD:true, IPB:true, CJR:true },
          teamOn:{ HZO:true, MJD:true, IPB:true, PYR:true } };
  const plain = ownerOptions('');
  is(/value="MJD"/.test(plain), true, 'an active on-roster member is offered');
  is(/value="HZO"/.test(plain), false, 'HZO is not: admin is never an assignable bench owner');
  is(/value="CJR"/.test(plain), false, 'a leaver is not offered');
  is(/value="PYR"/.test(plain), false, 'nor is an inactive member');
  is(/<option value="" selected>\(none\)<\/option>/.test(plain), true, 'and (none) is selected when nothing is');

  is(/value="CJR" selected/.test(ownerOptions('CJR')), true, 'but a leaver already ON a row is shown');
  is(/Callum Reyes \(left\)/.test(ownerOptions('CJR')), true, 'labelled so, because the reader needs to know why');
  is(/Priya Raman \(inactive\)/.test(ownerOptions('PYR')), true, 'and an inactive member is labelled differently again');
  is(/value="HZO" selected/.test(ownerOptions('HZO')), true, 'the admin escape works too, on a row that names them');
  is(/\(left\)/.test(ownerOptions('MJD')), false, 'a current member carries no suffix at all');
  // Precedence: a code that is both off-roster and inactive reads as LEFT, which is the stronger
  // fact and the one that decides what to do about the row.
  APP.teamActive.CJR = false;
  is(/Callum Reyes \(left\)/.test(ownerOptions('CJR')), true, 'off-roster beats inactive in the label');

  // Escaping. Names come from the database and land inside a double-quoted attribute and a text
  // node in the same string.
  APP = { team:{ 'X"Y':'A & B <script>' }, teamActive:{ 'X"Y':true }, teamOn:{ 'X"Y':true } };
  const e = ownerOptions('');
  is(/&quot;/.test(e), true, 'a quote in a code is escaped, so it cannot close the value attribute');
  is(/&amp; B &lt;script&gt;/.test(e), true, 'and the name is escaped in the label');
  is(/<script>/.test(e), false, 'nothing raw survives into the markup');
}

// ---------------------------------------------------------------- 8. the v0.21 filters
// One source of truth per tab, because the TSV copy reads the same function the table does. Two
// filters that agree on screen and disagree in the clipboard is the failure this shape prevents.
console.log('\nFILTERS  (v0.21, and the TSV reads the same function the table does)');
{
  const lot = (id, product, type, f) => Object.assign({ id, product, lot_type:type, year:26, seq:id,
    frozen:false, is_use_test:false, d1:null, d2:null, d3:null, lab_report_number:null,
    experiment_start:null, experiment_end:null }, f || {});
  APP = { lots:[ lot(1,'TRV','Standard'), lot(2,'TRV','Use Test',{ is_use_test:true }),
                 lot(3,'TRV','Standard',{ frozen:true }), lot(4,'BXE','Standard') ],
          lotFilterType:'all', lotFilterStatus:'all' };
  const ids = rows => rows.map(r => r.id).join(',');
  is(ids(lotRows('TRV')), '3,2,1', 'product filters first, and the sort is newest seq first');
  is(ids(lotRows('BXE')), '4', 'a different product sees only its own');
  setLotFilter('type', 'Standard');
  is(ids(lotRows('TRV')), '3,1', 'the type filter narrows it');
  setLotFilter('status', 'open');
  is(ids(lotRows('TRV')), '1', 'and the status filter stacks with it rather than replacing it');
  setLotFilter('type', 'all');
  is(ids(lotRows('TRV')), '2,1', 'clearing one filter leaves the other in force');
  setLotFilter('status', 'frozen');
  is(ids(lotRows('TRV')), '3', 'status reads lotLife, so frozen means what the lock rules say it means');
  setLotFilter('status', 'all');
  is(ids(lotRows('TRV')), '3,2,1', 'and all restores everything');

  APP = { lrs:[ { id:1, year:2026, lr_type:'Campaign', report_date:null },
                { id:2, year:2026, lr_type:'Analytical', report_date:'2026-07-01' },
                { id:3, year:2025, lr_type:'Campaign', report_date:null } ],
          activeYear:'all', lrFilterType:'all', lrFilterStatus:'all' };
  is(ids(lrRows()), '1,2,3', 'LRs arrive pre-sorted and are not re-sorted here');
  APP.activeYear = 2026;
  is(ids(lrRows()), '1,2', 'the year tab filters');
  is(ids(lrRows()), ids(lrRows()), 'and the function is pure: the TSV cannot see a different set');
  setLrFilter('type', 'Campaign');
  is(ids(lrRows()), '1', 'type stacks on year');
  setLrFilter('type', 'all'); setLrFilter('status', 'open');
  is(ids(lrRows()), '1', 'open means not lrLocked');
  setLrFilter('status', 'closed');
  is(ids(lrRows()), '2', 'and anything else means locked, so the two partition the set');

  // The type list is built from the rows AND the lookup, so a type used on a row but since
  // deactivated still appears. Without that the filter cannot reach rows that exist.
  const opts = filterTypeOptions([{ value:'Analytical', active:true }],
                                 [{ lot_type:'Retired Type' }], 'lot_type', 'all');
  is(/Retired Type/.test(opts), true, 'a deactivated type still in use stays selectable');
  is(/Analytical/.test(opts), true, 'and an active unused one is offered');
  is(/<option value="all" selected>All types/.test(opts), true, 'with All types selected by default');
  is(opts.indexOf('Analytical') < opts.indexOf('Retired Type'), true, 'sorted, so the list does not reshuffle');
  is(/&lt;/.test(filterTypeOptions([], [{ lot_type:'<b>' }], 'lot_type', 'all')), true,
     'and a type name is escaped: it comes from a table anyone with the console can edit');
}

// ---------------------------------------------------------------- 9. the write gate
console.log('\nWRITE GATE');
{
  APP = { isAdmin:false, me:{ code:'IPB' } };
  is(canAct('IPB'), true, 'you can act on your own row');
  is(canAct('MJD'), false, 'and not on somebody else\'s');
  APP.isAdmin = true;
  is(canAct('MJD'), true, 'admin acts on anything');
  APP = { isAdmin:false, me:null };
  is(canAct('IPB'), false, 'and a caller with no identity acts on nothing, rather than on everything');
  is(/APP\.me\.code/.test(body('canAct')), true, 'the gate reads the caller identity, not a rendered value');
}

// ---------------------------------------------------------------- 10. rpc surface
// A new name must be added here or this fails, and EDITING A CHECKER TO MAKE A BUILD PASS IS
// HOW A SUITE HOLLOWS OUT.
//
// THE COMPUTED NAME. release_lot / release_lr are called as sb.rpc(fn, ...) off a ternary, so a
// literal scan sees neither. That exact shape is recorded across the suite as the way a call goes
// invisible to a whitelist. Both branches are pulled out of the ternary and checked as names.
//
// PORT NOTE. The whitelist is now checked against core.js as well as against this page, which
// closes a hole the original could not: a name could be called here and not exist at the far end,
// and nothing would say so until somebody pressed the button.
console.log('\nRPC SURFACE');
{
  const OK = ['whoami','caller_is_admin','team_members','reserve_lot','reserve_lr',
              'update_lot','update_lr','revise_lr','release_lot','release_lr'];
  const lit = [...new Set([...code.matchAll(/sb\.rpc\(\s*'([a-z_]+)'/g)].map(m => m[1]))];
  const computed = [...code.matchAll(/sb\.rpc\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g)].map(m => m[1]);
  is(lit.filter(n => !OK.includes(n)).join(','), '', 'every literal RPC name is on the verified list');
  is(computed.length, 1, 'exactly one computed RPC name, which is the release ternary');
  const asn = code.match(/const\s+(?:fn)\s*=\s*[^;]*?'([a-z_]+)'\s*:\s*'([a-z_]+)'/);
  is(!!asn, true, 'the computed name resolves to a ternary of two literals, not to something dynamic');
  if (asn){
    is(OK.includes(asn[1]) && OK.includes(asn[2]), true,
       'and both branches (' + asn[1] + ', ' + asn[2] + ') are on the verified list');
  }
  // NEW, and only possible now the far end is local: every name this page calls exists there.
  const missing = OK.filter(n => typeof core.RPCS[n] !== 'function');
  is(missing.join(','), '', 'every name on the list is implemented in core.js');
}

// ---------------------------------------------------------------- 10b. the read surface
// Was: five tables read directly by name. The inline selects are gone; the page asks the named
// registry instead, so the assertion follows the reads rather than being dropped with them.
console.log('\nREAD SURFACE');
{
  const named = [...new Set([...code.matchAll(/core\.read\(\s*'([A-Za-z_]+)'/g)].map(m => m[1]))].sort();
  is(named.join(','), 'labReports,lotTypeValues,lots,lrTypeValues,productCodes',
     'five named reads, all of them read-only surfaces');
  is(named.filter(n => !core.READS[n]).join(','), '', 'and every one of them is in the registry');
  // .select(' with a string argument, not .select( bare: the copy-as-TSV helper calls
  // textarea.select() and that is a DOM selection, not a projection.
  is(/sb\.from\(|\.select\('/.test(code), false,
     'no inline query building survives: the page names a read, it does not compose one');
  is(/core\.read\(\s*'people'/.test(code), false,
     'people is never read directly: team_members() is the only roster surface');
}

// ---------------------------------------------------------------- 10c. the registry itself
// The executor is allowed exactly three capabilities. A fourth is a change of shape, and the
// place to notice it is here, not in review.
console.log('\nREAD REGISTRY SHAPE');
{
  const keys = new Set();
  Object.keys(core.READS).forEach(k => Object.keys(core.READS[k]).forEach(x => keys.add(x)));
  is([...keys].sort().join(','), 'cols,eq,from,order',
     'the registry carries only from, cols, order and eq');
  is(Object.keys(core.READS).filter(k => core.READS[k].eq).length, 1,
     'exactly one read uses an equality, and it is a constant');
  is(Object.keys(core.READS).filter(k => (core.READS[k].order || []).length > 2).join(','), '',
     'and no read orders on more than two keys');
}

// ---------------------------------------------------------------- 11. auth shape
// The login SCREEN is removed; the auth SURFACE is not, and this section is why it was listed
// as needing core.js rather than as dying. The session is still real and still gates every
// write, so the shape is still worth holding - it just lives at the other end of the seam now.
console.log('\nAUTH');
{
  const A = core.auth;
  is(typeof A.signInWithPassword, 'function', 'password sign-in survives the port');
  is(typeof A.signOut,            'function', 'so does sign-out');
  is(typeof A.onAuthStateChange,  'function', 'and the state subscription the page routes on');
  is(typeof A.updateUser,         'function', 'and updateUser, which the change-password path used');
  is(/signInWithOtp|verifyOtp/.test(code), false, 'the OTP path is gone, not merely unreachable');
  is(/signUp\(/.test(code), false, 'and no signup path');
  // `code` again, for the same reason: the [REMOVED] note lists the functions by name.
  is(/loginScreen|auth-screen|openChangePassword/.test(code), false,
     'the login screen is gone from the script, not merely hidden');
}

// ---------------------------------------------------------------- the postures at the seam
// ADDED BECAUSE A MUTATION SURVIVED. Deleting the roster test from core.js's requireWriter --
// letting a person whose last day has passed keep writing -- turned no suite red.
//
// There is already a WRITE GATE group above and it did not catch this, which is the useful part:
// it asserts OWNERSHIP, that you may act on your own row and not on someone else's. That is a
// different question from whether you may write at all. Ownership was covered twice over and
// posture was covered nowhere, and the gap is invisible until something goes looking for it.
//
// THREE POSTURES, and they are not a scale. Posture 1 writes. Posture 2 is the trainee or the
// person on long absence: reads everything, writes nothing, still here. A leaver is neither, and
// the refusal has to be by DATE, because under the model the console writes a leaver is
// active=TRUE with a past date and anything reading the active flag alone waves them through.
// The two refusals must also say different things: "your account cannot write" and "you are off
// the roster" send a person to different people for a fix.
console.log('\nPOSTURES AT THE SEAM');
{
  const db = core.db();
  const parked = db.people.filter(p => !p.active && !p.roster_until)[0];
  const leaver = db.people.filter(p => p.roster_until && p.roster_until < core.today())[0];
  is(!!parked && !!leaver, true, 'the seed carries a posture 2 and a leaver to test against');

  // Synchronous on purpose. core.rpc wraps its answer in a promise, and a promise chain here
  // resolves AFTER the summary line has already counted the failures and printed. The first cut
  // of this block did exactly that: four assertions that never ran, under a suite that said it
  // passed. RPCS is the same function rpc() calls, one layer down, and it answers in hand.
  const signIn = p => { core.auth.signInWithPassword({ email: p.email, password: 'x' }); };
  const write  = () => core.RPCS.reserve_lot({ p_product: db.products[0].code, p_year: core.year2(),
                                               p_lot_type: 'Standard', p_purpose: 'posture probe' });
  signIn(parked);
  const rp = write();
  is(!!rp.error, true, 'posture 2 is refused: inactive reads everything and writes nothing');
  is(/cannot write/i.test((rp.error || {}).message || ''), true, 'and is told it is the account');
  signIn(leaver);
  const rl = write();
  is(!!rl.error, true, 'a leaver is refused outright, by DATE and not by the active flag');
  is(/roster/i.test((rl.error || {}).message || ''), true,
     'and is told it is the roster, because those two send you to different people');
  core.reset();
}

// ---------------------------------------------------------------- viewing as
// NEW with the picker. It is the stand-in for signing in, so the assertion that matters is that
// choosing somebody CHANGES THE SESSION, and changes it to the posture that person holds, rather
// than relabelling a header over a session that is still the default chemist. A picker the seam
// ignores looks exactly like a working one until somebody tries to be refused.
console.log('\nVIEWING AS');
{
  const db = core.db();
  const as = code => { core.setViewingAs(code); core.signInDefault(); };
  const r = n => core.RPCS[n]().data;

  as(null);
  is(r('caller_code'), core.DEFAULT_USER, 'nobody picked: the queue opens as the default chemist');
  as('MJD');
  is(core.viewingAs(), 'MJD', 'the choice is held by core.js');
  is(r('caller_code'), 'MJD', 'and the session IS that person: caller_code answers for them');
  is((r('whoami')[0] || {}).code, 'MJD', 'whoami agrees, so this page routes as them');

  const parked = db.people.filter(p => !p.active && !p.roster_until)[0];
  as(parked.code);
  is(r('whoami').length, 0, 'posture 2 gets no whoami row, so this page refuses them outright');
  is(r('caller_roster_code'), parked.code, 'while the schedule door still opens for them');
  is(r('caller_code'), null, 'and caller_code, the write tier, is null');

  const leaving = db.people.filter(p => !p.active && p.roster_until && p.roster_until >= core.today())[0];
  is(!!leaving, true, 'the seed carries a posture 5 to test against');
  as(leaving.code);
  is(r('whoami').length, 0, 'posture 5 is refused here too: whoami is active-only');

  as(core.ADMIN_CODE);
  is(r('caller_is_admin'), true, 'the admin, picked, is the admin');
  as('IPB');
  is(r('caller_is_admin'), false, 'and nobody else is');

  core.setViewingAs(null);
  core.signInDefault(core.ADMIN_CODE);
  is(r('caller_code'), core.ADMIN_CODE, "with nobody picked, a page's own fallback stands (the console's)");
  core.setViewingAs('ZZZ');
  is(core.viewingAs(), null, 'a code nobody holds is not a choice');

  // The page half: the picker is in the header, it hands the choice to core.js and reloads, and
  // the page signs in through the path that reads it.
  is(/<select data-viewas onchange="viewAsChange\(this\.value\)">/.test(bare), true, 'the picker is in the header');
  is(/function viewAsChange\(code\)\{ core\.setViewingAs\(code\); location\.reload\(\); \}/.test(code), true,
     'a change goes to core.js and reloads, so every gate runs fresh as the new person');
  is(/core\.signInDefault\(\);\s*viewAsFill\(core\.DEFAULT_USER\);/.test(code), true,
     'and the page signs in through signInDefault, which is what reads the choice');
  is(/cannot use the queue/.test(code), true, 'a refused account is told so on the page, not only by a toast');
  // Found in the browser, not by reading: #app starts hidden, so a refusal that never shows it
  // leaves a blank page, header and picker included, and the person cannot pick anybody else.
  is(/if \(!me\)\{[\s\S]{0,120}?showScreen\('app'\)/.test(code), true,
     'and the refusal shows the page shell, so the picker is still there to switch back');
  core.setViewingAs(null); core.signInDefault(); core.reset();
}

// ---------------------------------------------------------------- 12. the shared column sets
// NEW. The audit found lots and lab_reports selected with different column lists in the console
// than here - the console was short edited_by and edited_at. Two copies of one projection, already
// drifted, and nothing covered it. Reconciled on the wider list and declared once in core.js;
// this is the assertion that stops it drifting back.
console.log('\nSHARED COLUMN SETS');
{
  is(Array.isArray(core.LOT_COLS) && core.LOT_COLS.length > 0, true, 'core.LOT_COLS is declared');
  is(Array.isArray(core.LR_COLS)  && core.LR_COLS.length  > 0, true, 'core.LR_COLS is declared');
  is(core.READS.lots.cols === core.LOT_COLS, true,
     'the lots read uses the shared constant, not a copy of it');
  is(core.READS.labReports.cols === core.LR_COLS, true,
     'the lab_reports read uses the shared constant, not a copy of it');
  is(core.LOT_COLS.includes('edited_by') && core.LOT_COLS.includes('edited_at'), true,
     'the reconciled lot list keeps edited_by and edited_at, which the console had dropped');
  is(core.LR_COLS.includes('edited_by') && core.LR_COLS.includes('edited_at'), true,
     'and so does the report list');
  is(/'id,lot_number|'id,lr_number/.test(code), false,
     'and no inline column list survives in the page to drift away from it');
}

// [REMOVED] BUILD CURRENCY, 16 assertions. The stale-tab check is gone: nothing is deployed,
// so no tab can be behind. This is the largest single block of the 99 dying assertions and it
// is deleted rather than retargeted, because there is no remaining fact for it to hold.

console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'all checks pass'));
process.exit(fails ? 1 : 0);
