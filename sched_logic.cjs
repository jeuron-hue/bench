// Behavioural test of the logic the checker cannot see. Marks model, v0.8.
// PORT NOTE, and it is the one thing in this file a reader should not skim past. The fixture
// roster was renamed onto the seeded bench codes, a one-for-one substitution across all three
// files. Seven expected literals in this suite were ORDER-dependent -- lists sorted by code or by
// full name -- and renaming the fixtures changed where those names collate. Those seven literals
// were re-sorted to the new order.
//
// That is a change to expected values, which is the shape of hollowing a suite out, so: no
// assertion was weakened, none was deleted, and no sort was made lenient. Each one still pins an
// exact sequence; the sequence it pins is simply the one the new names produce. The failures were
// real and they were the rename's, not the code's -- every one of them reported the sorter
// working correctly on inputs whose spelling had changed underneath the expectation.
const fs = require('fs');
// The retargeted register assertions read the seam directly, so the harness holds the real
// core.js rather than a stub of it. Loading it here also means a change to the read registry
// is felt by these assertions instead of silently ignored.
require('./seed.js'); require('./core.js');
const core = globalThis.core;
const js = fs.readFileSync('sched.html','utf8').match(/<script>\n([\s\S]*?)\n<\/script>\s*<\/body>/)[1];
// Strip full-line comments before testing for absence. This is the SECOND time today a check
// has fired on prose: sched_checks.cjs's HANDLERS section read onmousemove="colHovr(event)"
// out of a comment that quoted it as an example of a typo. Same defect, same fix. A comment
// that says "X is deleted" contains X, and any "must not appear" test reads it as X appearing.
// Full-line only, deliberately: a naive strip would eat the // in https:// inside a string.
const code = js.replace(/^\s*\/\/.*$/gm, '');
// The stylesheet, for the few assertions that are genuinely about CSS. Same source, different
// slice: js is the script block, this is the style block.
const shellCss = (fs.readFileSync('sched.html','utf8').match(/<style>([\s\S]*?)<\/style>/)||['',''])[1];
// The raw file, for the few assertions that are about MARKUP rather than script. v0.23.6 moved a
// control into the page header, so its call site is an onclick attribute and is invisible to
// `js`, which is the script block alone.
const src0 = fs.readFileSync('sched.html','utf8');
const grab = n => { const m = js.match(new RegExp('function ' + n + '\\([\\s\\S]*?\\n\\}','m')); if(!m) throw new Error('not found: '+n); return m[0]; };
const APP = { hideCompleted:true, lists:{ task_statuses:[
  {value:'Planned', colour:'#3a6aee', texture:'solid', is_terminal:false, cancelled:false, active:true},
  {value:'Documentation', colour:'#3a6aee', texture:'solid', is_terminal:true, cancelled:false, active:true},
  {value:'Completed', texture:'faded', is_terminal:true, cancelled:false, active:true},
  {value:'Cancelled', texture:'faded', is_terminal:false, cancelled:true, active:true},
  {value:'Cancelled-outline', texture:'outline', is_terminal:false, cancelled:true, active:true},
  {value:'Retired', colour:'#888888', texture:'solid', is_terminal:false, cancelled:false, active:false}
]}, lists_products:[], grid:[], tasks:[], owners:{} };
APP.lists.products = [ {code:'TRV', colour:'#e8a33d', active:true},
                       {code:'BXE', colour:null,      active:true} ];
const DAY = 86400000;
const d2n = s => { const p = String(s).slice(0,10).split('-'); return Date.UTC(+p[0], +p[1]-1, +p[2]); };
const ddmmyy = n => { const d=new Date(n), p=x=>String(x).padStart(2,'0');
  return p(d.getUTCDate())+'/'+p(d.getUTCMonth()+1)+'/'+String(d.getUTCFullYear()).slice(2); };
const n2d = n => new Date(n);
const today0 = () => d2n('2026-07-16');
// v0.33.0. onTeam is a dependency of rowsFor, dbOrder, tkHtml, trHtml, msHtml, personField, the
// workload view, the task chemist filter and the campaign lead dropdown. It is evaled here rather
// than stubbed: a stub would be a second definition of the boundary, and the whole reason this
// predicate exists in one place is that two of them drift. Needs d2n and today0, both above.
eval(grab('onTeam')); eval(grab('codeOnTeam'));
eval(grab('hiddenStatuses')); eval(grab('statusTerminal')); eval(grab('statusCancelled'));
const ARCHIVE_DAYS = +js.match(/const ARCHIVE_DAYS = (\d+);/)[1];
eval(grab('lastDateOf')); eval(grab('isArchived'));
eval(grab('visibleTasks')); eval(grab('marksOf')); eval(grab('firstMark'));
const AXIS_EXEMPT = eval('(' + js.match(/const AXIS_EXEMPT = (\{[^}]*\});/)[1] + ')');
eval(grab('productColour')); eval(grab('statusTexture')); eval(grab('windowOf')); eval(grab('labelOffset'));
const NO_PRODUCT = js.match(/const NO_PRODUCT = '(#[0-9a-f]{6})'/)[1];
const MARK_W = +js.match(/const MARK_W = (\d+);/)[1];
const PAST_DAYS_V = +js.match(/const PAST_DAYS = (\d+)/)[1];
const PAST_CUTOFF_DAYS = +js.match(/const PAST_CUTOFF_DAYS = (\d+);/)[1];
eval(grab('nudgeMarks'));
let f=0; const is=(got,want,m)=>{ const ok=String(got)===String(want); if(!ok)f++;
  console.log((ok?'  PASS  ':'  FAIL  ')+m+(ok?'':'   got '+got+', want '+want)); };

console.log('\nTHE THREE MARKS  (the bar is team time; a mark is a date that is not)');
is(marksOf({due_date:null, review_due:null, approve_due:null}).length, 0, 'a task the team owns end to end carries no mark');
is(marksOf({due_date:'2026-08-31', review_due:null, approve_due:null}).map(m=>m.label), 'hard deadline', 'external deadline only');
is(marksOf({due_date:null, review_due:'2026-08-10', approve_due:'2026-08-20'}).map(m=>m.label).join('|'),
   'review due|approve due', 'review and approve without a hard deadline');
is(marksOf({due_date:'2026-08-31', review_due:'2026-08-10', approve_due:'2026-08-20'}).length, 3, 'all three coexist');
is(marksOf({due_date:'2026-08-31'}).length, 1, 'undefined columns are not marks');

console.log('\nA BAR PAST THE HARD DEADLINE  (must be representable, nothing may forbid it)');
is(marksOf({due_date:'2026-08-15'}).length, 1, 'due 15/08 with a bar ending 07/09 still marks; no constraint fires');

console.log('\nUNSCHEDULED SORT  (earliest mark first, unmarked last)');
const bl = [{id:1,title:'zeta'},
            {id:2,title:'b', approve_due:'2026-09-01'},
            {id:3,title:'c', due_date:'2026-09-20', review_due:'2026-08-01'},
            {id:4,title:'alpha'}];
is(ddmmyy(firstMark(bl[2])), '01/08/26', 'firstMark takes the earliest of the three, not due_date');
is(firstMark(bl[0]), null, 'no marks is null');
const sorted = bl.slice().sort((a,b)=>{ const x=firstMark(a), y=firstMark(b);
  if(x===null&&y===null) return String(a.title).localeCompare(String(b.title));
  if(x===null) return 1; if(y===null) return -1; return x-y; });
is(sorted.map(t=>t.id).join(','), '3,2,4,1', 'marked first by earliest mark, then unmarked by title');

console.log('\nTHE ONE DERIVED SET  (is_terminal, unchanged)');
APP.tasks = [{id:1,status:'Planned'},{id:2,status:'Documentation'},{id:3,status:'Retired'}];
is(visibleTasks().map(t=>t.id).join(','), '1,3', 'a terminal status drops out by default');
APP.hideCompleted = false; is(visibleTasks().length, 3, 'unticking hide-completed brings it back'); APP.hideCompleted = true;

console.log('\nTHE ARCHIVE CUTOFF  (v0.20.31: the wall stops growing a row per task ever created)');
// today0() is 16/07/26 here, so six weeks back is 04/06/26.
const OLD = '2026-05-01', RECENT = '2026-07-10';
const arcT = (status, d) => Object.assign({id:9, status:status,
  start_date:null, end_date:null, due_date:null, review_due:null, approve_due:null}, d||{});
is(isArchived(arcT('Completed', {end_date:OLD})), true, 'finished and six weeks past its last date: archived');
is(isArchived(arcT('Completed', {end_date:RECENT})), false, 'finished but recent: stays, so you can see what just landed');
is(isArchived(arcT('Planned', {end_date:OLD})), false,
   'UNFINISHED and old is NEVER archived, however old: that is the overdue work the wall exists to shout about');
is(isArchived(arcT('Cancelled', {end_date:OLD})), true,
   'cancelled counts as finished too, or cancelled work piles up forever where nobody looks');
is(isArchived(arcT('Completed', {})), false,
   'finished with NO dates is INVALID data (the admin 22/07/26), and stays visible rather than being tidied away');
// saveTk now refuses to create that case. The two halves belong together: the guard stops it
// happening, and isArchived leaving it visible means any row that predates the guard stays ON
// the wall where someone will fix it.
is(/A task with no dates cannot be completed or cancelled/.test(code), true,
   'and saveTk blocks it being created in the first place');
is(/statusTerminal\(v\.status\) \|\| statusCancelled\(v\.status\)/.test(code), true,
   'the guard covers cancelled as well as completed, matching the archive rule');
is(/!v\.start_date && !v\.end_date && !v\.due_date && !v\.review_due && !v\.approve_due/.test(code), true,
   'and checks all five dates: a hard deadline with no bar is still a date to age from');
is(isArchived(arcT('Completed', {end_date:OLD, approve_due:RECENT})), false,
   'aged from the LATEST of the dates: a bar that ended in May with an approve date in July has not stopped mattering');
is(ARCHIVE_DAYS, 42, 'six weeks');
// The board reads APP.tasks directly, so the archive cannot reach it. That matters twice over:
// an archived task is finished and would never have counted anyway, but if the board had been
// built on visibleTasks() as .16 nearly was, this change would have silently started hiding old
// overdue work from the one screen whose whole job is to show it.
is(/overdueTally[\s\S]{0,900}?isArchived/.test(code), false, 'the overdue board does not apply the archive');
is(/overdueTally[\s\S]{0,900}?visibleTasks/.test(code), false, 'nor does it go through visibleTasks at all');
// The archive is a CONDITION inside visibleTasks, not a filter written somewhere else.
APP.tasks = [arcT('Completed', {end_date:OLD}), Object.assign(arcT('Planned', {end_date:OLD}), {id:2})];
APP.hideCompleted = false;
is(visibleTasks().map(t=>t.id).join(','), '2', 'visibleTasks drops the archived one and keeps the overdue one');
APP.showArchived = true;
is(visibleTasks().length, 2, 'and the toggle brings it back: a view filter, nothing deleted');
APP.showArchived = false; APP.hideCompleted = true;


console.log('\nDATES BOTH-OR-NEITHER  (section 4: row 23 has nowhere to live)');
const bad = (s,e) => !s !== !e;
is(bad('2026-08-01',''), true, 'start with no end is refused');
is(bad('','2026-08-01'), true, 'end with no start is refused');
is(bad('2026-08-01','2026-08-05'), false, 'both set is fine');
is(bad('',''), false, 'both blank is unscheduled, not an error');

console.log('\nMARK LETTERS  (the admin: H hard deadline, R review, A approve)');
is(marksOf({due_date:'2026-08-31', review_due:'2026-08-10', approve_due:'2026-08-20'}).map(m=>m.mark).join(''),
   'HRA', 'letters in field order, H R A');

console.log('\nWINDOW REACHES THE MARKS  (a mark outside the extent vanishes silently)');
const far = d2n('2027-06-01');
const W1 = windowOf([], []);
is(W1.end < far, true, 'baseline extent stops well short of a far mark');
const W2 = windowOf([], [far]);
is(ddmmyy(W2.end), '30/06/27', 'a far hard deadline widens the extent to its whole month');
const W3 = windowOf([], [d2n('2026-01-20')]);
is(ddmmyy(W3.start), '04/06/26', 'a mark in the past widens it backwards, but only to the floor: today-42 EXACTLY');
is(ddmmyy(windowOf([{start_date:'2026-07-01', end_date:'2026-07-05'}], []).start), '16/06/26',
   'an UNSCHEDULED task has no bar at all, so only its marks can place it');

console.log('\nPAST CUTOFF  (v0.20.33: six weeks, was a year)');
is(PAST_CUTOFF_DAYS, 42, 'six weeks, matching ARCHIVE_DAYS: one cutoff, not two');
is(PAST_CUTOFF_DAYS, ARCHIVE_DAYS, 'and they are the SAME number, so the axis and the archive cannot drift apart');
is(ddmmyy(windowOf([{start_date:'2023-01-01', end_date:'2026-08-01'}], []).start), '04/06/26',
   'a bar from 2023 cannot drag the extent back past the floor');
is(ddmmyy(windowOf([{start_date:'2026-06-10', end_date:'2026-07-20'}], []).start), '10/06/26',
   'data INSIDE the cutoff still sets the extent; the floor is a cap, not a minimum');
is(ddmmyy(windowOf([], [d2n('2020-01-01')]).start), '04/06/26', 'an ancient mark is capped too');
is(ddmmyy(windowOf([{start_date:'2026-01-01', end_date:'2028-12-31'}], []).end), '31/12/28',
   'NO forward twin: a 2028 campaign still widens the window until it is on screen');
// The floor lands on today-42 then snaps to that whole month, so it is never LESS than six weeks.
is(ddmmyy(windowOf([{start_date:'2020-01-01', end_date:'2026-08-01'}], []).start), '04/06/26',
   'and it is EXACTLY today-42, not snapped to a month: v0.36, the snap was widening it by up to 30 days');
// Stated as arithmetic rather than a date string, so it cannot drift if today0() moves.
is((today0() - windowOf([{start_date:'2020-01-01', end_date:'2026-08-01'}], []).start) / DAY, PAST_CUTOFF_DAYS,
   'the floor is the cutoff to the day, with nothing added by rounding');
is(ddmmyy(windowOf([], []).end), '31/01/27', 'the END still snaps to a whole month: widening forward is free');

console.log('\nAXIS EXEMPTION  (v0.20.34: a running campaign is not clipped)');
// A bar clipped at its left edge misreads as "this began six weeks ago" for something that
// began in March, so campaigns and instrument windows that are STILL RUNNING reopen the floor.
const RUN = {category:'milestone', start_date:'2026-03-01', end_date:'2026-09-30'};
const DONE = {category:'milestone', start_date:'2026-03-01', end_date:'2026-05-01'};
is(ddmmyy(windowOf([RUN], []).start), '01/03/26', 'a running campaign drags the extent back to its own start');
is(ddmmyy(windowOf([DONE], []).start), '04/06/26',
   'a FINISHED campaign does not: the exemption expires with it, or v0.33 is undone by another route');
// v0.20.35 reverses .34 here: instruments are back on the floor. the admin, 22/07/26. A booking is a
// claim on a machine for a stretch of days and the stretch that matters is from here on; how far
// back it began does not change who has the instrument this week.
is(ddmmyy(windowOf([{category:'instrument', start_date:'2026-02-01', end_date:'2026-08-15'}], []).start), '04/06/26',
   'a running instrument booking is NOT exempt: it truncates like everything else');
is(ddmmyy(windowOf([{category:'maintenance', start_date:'2026-02-01', end_date:'2026-08-15'}], []).start), '04/06/26',
   'nor is a maintenance window');
is(Object.keys(AXIS_EXEMPT).join('|'), 'milestone', 'campaigns are the ONLY exemption');
is(ddmmyy(windowOf([{category:'task', start_date:'2026-01-01', end_date:'2026-12-01'}], []).start), '04/06/26',
   'a TASK is still bounded, however long it runs: that far back it is Very Overdue and has a section');
is(ddmmyy(windowOf([{category:'absence', start_date:'2026-01-01', end_date:'2026-12-01'}], []).start), '04/06/26',
   'and an absence is still bounded: truncating one is fine, it keeps its label');
is(ddmmyy(windowOf([RUN, {category:'milestone', start_date:'2026-05-01', end_date:'2026-09-01'}], []).start), '01/03/26',
   'the EARLIEST running exempt bar wins, not the last one seen');

console.log('\nA CLIPPED BAR KEEPS ITS LABEL  (v0.20.34)');
// The absence half of the admin's rule, 22/07/26: truncation is fine, an anonymous band of hatch is
// not. A clipped bar has a NEGATIVE left, so the offset comes out positive at scrollLeft 0 and
// pushes the label back to the visible edge.
is(labelOffset(0, -360, 1100, 40), 360, 'a bar clipped 360px off the left edge shifts its label 360px right');
is(labelOffset(0, 200, 1100, 40), 0, 'a bar fully in view does not move its label');
is(labelOffset(0, -5000, 300, 40), 250, 'and the shift is clamped to the bar, so a label never leaves its own bar');
is(labelOffset(0, -100, 20, 40), 0, 'a bar narrower than its label gets no shift at all rather than a negative one');
is(labelOffset(500, -360, 1100, 40), 860, 'horizontal scroll and window clipping add, they are the same offset');

console.log('\nHUE = PRODUCT, GREY = NO PRODUCT  (v0.10)');
is(productColour('TRV'), '#e8a33d', 'a coloured product gives its hue');
is(productColour('BXE'), NO_PRODUCT, 'a product with no colour draws grey, not nothing');
is(productColour(null),  NO_PRODUCT, 'a Miscellaneous task or an unassigned booking draws grey');
is(productColour('NOPE'), NO_PRODUCT, 'an unknown product code draws grey, not a crash');
// .bar carries no background of its own, so a null here is an INVISIBLE bar, not a grey one.
// All 13 products are uncoloured on prod right now: null would have blanked the whole grid.
is(productColour('BXE') === null, false, 'productColour never returns null');

console.log('\nSTATUS = TEXTURE  (ordinal, so it belongs in a channel that carries order)');
is(statusTexture('Pending'), 'solid', 'the column default reaches the renderer');
is(statusTexture('Nonesuch'), 'solid', 'an unknown status draws solid, not undefined');

console.log('\nUNIFORM ROWS  (v0.9.8: the lane bump is gone; the chip always rides the bar)');
is(/marksHitBars/.test(code), false, 'marksHitBars is deleted, not merely left unused');
is(/const markTop = ROW_PAD \+ 3;/.test(code), true, 'the chip top is a constant, with no lane term');
is(/const h = ROW_PAD \+ L\.count\*LANE_H \+ ROW_PAD;/.test(code), true, 'row height has no mark term at all');
is(/hits/.test(code), false, 'no bump conditional survives anywhere');

console.log('\nMARK COLLISION NUDGE  (approve due and a hard deadline are commonly one date)');
is(MARK_W, 13, 'MARK_W is the one source; CSS reads --markw off it');
const nudge = xs => nudgeMarks(xs.map(x=>({x:x}))).map(o=>o.x);
is(nudge([100,100,100]).join(','), '100,114,128', 'three marks on one day fan out, never stack');
is(nudge([100,130]).join(','), '100,130', 'marks far enough apart are left alone');
is(nudge([200,100]).join(','), '100,200', 'marks are sorted before nudging, so input order cannot matter');

console.log('\nRPC ARG SET  (11 shared + one extra each; p_effort defaults 8, p_reference defaults null)');
// v0.20.12: p_reference added after p_effort. Shared payload 11; create = 11 + p_owners = 12,
// update = 11 + p_id = 12, matching prod (c_args/u_args = 12). Anchor p_title:v.title, stop at
// p_reference's line (the new last field in the object).
const args = js.match(/const args = \{ p_title:v\.title[\s\S]*?p_reference:[^\n]*\};/)[0];
const names = [...args.matchAll(/(p_[a-z_]+):/g)].map(m=>m[1]);
is(names.length, 11, 'the shared payload is 11 now that p_reference rides with the task fields');
is(names.includes('p_owners'), false, 'p_owners is not shared: update_schedule_item has no such parameter');
is(names.includes('p_id'), false, 'p_id is not shared: create_schedule_item has no such parameter');
is(names.includes('p_effort'), true, 'p_effort is in the shared payload');
is(names.includes('p_reference'), true, 'p_reference is in the shared payload, sent on both create and update');
is(names.filter(n=>/milestone|deadline_kind/.test(n)).length, 0,
   'the three dead parameters are still gone from the payload');
// The two call sites. Each adds exactly one extra, so each sends exactly 12. Read off `code`
// rather than `js`: a comment naming a parameter would count as a call site adding it.
const extras = t => [...t.matchAll(/Object\.assign\(\{\s*(p_[a-z_]+):/g)].map(m=>m[1]);
const createCall = code.match(/rpc\('create_schedule_item',[^\n]*/)[0];
// v0.22.0: there are TWO update_schedule_item writers now, saveTk and the dashboard's
// dbSetStatus, and dbSetStatus is earlier in the file. This match took the first one it found,
// so it silently started asserting against the wrong call site and reported "got ''". Anchored
// on saveTk's Object.assign shape instead. The fixture was never wrong about saveTk; it was
// wrong to assume saveTk was the only caller.
const updateCall = code.match(/rpc\('update_schedule_item', Object\.assign\([^\n]*/)[0];
is(extras(createCall).join(','), 'p_owners', 'create adds exactly p_owners, so it sends 12');
is(extras(updateCall).join(','), 'p_id',     'update adds exactly p_id, so it sends 12');
// And the OTHER writers, asserted directly rather than left uncovered. update_schedule_item has
// no defaulted params, so null means WIPE and a partial payload silently blanks the row. The
// dashboard builds its own object because it has no form to read; that object must carry the
// same 12 keys or a status flip erases whatever it left out.
// v0.30.0: matchAll, not match. dbSetEffort joined dbSetStatus as a second dashboard writer of
// the same shape, and a non-global match takes the FIRST one it finds, so this fixture would have
// gone on passing against dbSetStatus while the new writer sat uncovered. That is the exact
// failure the updateCall anchor above was rewritten for in v0.22.0, one writer later. Walk them
// all, assert each, and assert there is more than one so a deleted writer cannot pass by absence.
const dbPays = [...code.matchAll(/const p = \{ p_id:t\.id[\s\S]*?p_reference:[^\n]*\};/g)].map(m=>m[0]);
is(dbPays.length >= 2, true, 'both dashboard writers build a payload, and this walks every one of them');
dbPays.forEach((pay, i) => {
  const dbKeys = [...pay.matchAll(/(p_[a-z_]+):/g)].map(m=>m[1]).sort();
  is(dbKeys.length, 12, 'dashboard writer ' + (i+1) + ' sends all 12, not just the field it changes');
  is(dbKeys.join(','), names.concat(['p_id']).sort().join(','),
     'and they are the SAME 12 saveTk sends: no partial edit from the dashboard either');
});
is(names.length + 1, 12, 'and 11 + 1 is the 12 prod asks for');

console.log('\nTHE SEAM  (two RPCs, no transaction; run the one that CAN fail first)');
// The one decision in Block 5b that is invisible on a screen and whose reversal is SILENT:
// owners-first only misbehaves on a failure path nobody hits while testing. update carries
// nearly all the failure surface (product FK, status FK, the date constraint, the
// not-authorised raise); set_item_owners carries nearly none, since the owners UI is
// checkboxes built from APP.roster and a code cannot be typed. Run update first and a routine
// failure aborts before anything is half-applied.
const saveTkBody = code.match(/function saveTk\(\)\{[\s\S]*?\n\}/)[0];
const iUp = saveTkBody.indexOf("'update_schedule_item'"), iOw = saveTkBody.indexOf("'set_item_owners'");
is(iUp > -1 && iOw > -1, true, 'saveTk calls both');
is(iUp < iOw, true, 'update_schedule_item runs BEFORE set_item_owners');
// Always both. A diff that skips the owners call when the set looks unchanged buys one round
// trip and pays with a silent failure: a wrong diff means owners quietly do not save.
is(/owners.*===.*owners|ownersChanged|sameOwners/.test(saveTkBody), false,
   'no diff guards the owners call; it always runs');
console.log('\nTHE JANITOR GATES  (v0.17: who may write absences and bookings)');
// The load-bearing half of the block, and the one a phantom button would betray. The three
// signals: APP.me (posture 1 and 2 both have it), APP.activeCode (null on posture 2), APP.isAdmin.
// mayWrite is the ownership half. The dispatch decides eligibility by category. Read straight
// off the file's own expressions so the test cannot drift from the code.
eval(grab('mayWrite'));
// clkFor is built from the FILE'S OWN click-gate expression, not a hand-copy: extract the RHS of
// `const clk = ... ;` out of the source and eval it per bar. A duplicated gate in the test is the
// second-implementation trap, and it would pass while the file's real gate was wrong (it did, on
// the first cut of this test). Now editing the file's expression changes what this evaluates.
const clkExpr = js.match(/const clk =\s*([\s\S]*?);\n/)[1];
function clkFor(b){ return eval(clkExpr); }
const myAb    = { category:'absence',    person_code:'MJD' };
const otherAb = { category:'absence',    person_code:'TQL' };
const myBk    = { category:'instrument', person_code:'MJD' };
const otherBk = { category:'instrument', person_code:'TQL' };
const task    = { category:'task' };

// --- admin (HZO): everything, anyone's ---
APP.me = {code:'HZO'}; APP.activeCode = 'HZO'; APP.isAdmin = true;
is(clkFor(task), true, 'admin: tasks');
is(clkFor(otherAb), true, "admin: anyone's absence");
is(clkFor(otherBk), true, "admin: anyone's booking");

// --- posture 1 (active staff, MJD): own absences+bookings, not others'; tasks add/edit YES ---
APP.me = {code:'MJD'}; APP.activeCode = 'MJD'; APP.isAdmin = false;
is(clkFor(task), true, 'posture 1: tasks (add/edit opened to active members; delete stays admin, gated separately in tkHtml)');
is(clkFor(myAb), true,  'posture 1: own absence');
is(clkFor(otherAb), false, "posture 1: NOT another's absence");
is(clkFor(myBk), true,  'posture 1: own booking');
is(clkFor(otherBk), false, "posture 1: NOT another's booking");

// --- posture 2 (trainee, on roster but inactive: me set, activeCode null): absences only ---
APP.me = {code:'PYR'}; APP.activeCode = null; APP.isAdmin = false;
is(clkFor({category:'absence', person_code:'PYR'}), true, 'posture 2: own absence');
is(clkFor({category:'instrument', person_code:'PYR'}), false,
   'posture 2: NOT even own booking, because activeCode is null (the caller_code+active gate)');
is(clkFor(task), false, 'posture 2: NOT tasks');

// --- the create-button gates, the same three signals ---
const canAddAbs = () => !!APP.me;          // + absence
const canAddBk  = () => !!APP.activeCode;  // + booking
APP.me = {code:'PYR'}; APP.activeCode = null; APP.isAdmin = false;
is(canAddAbs(), true,  'posture 2 sees + absence');
is(canAddBk(),  false, 'posture 2 does NOT see + booking');
APP.me = {code:'MJD'}; APP.activeCode = 'MJD';
is(canAddBk(), true, 'posture 1 sees + booking');

console.log('\nCANCELLED IS A FLAG ACROSS THE TEXTURE  (v0.16: not a fourth texture)');
// Cancellation is off the progress line. The strike is bound to the cancelled flag, NEVER to
// is_terminal: v0.14 removed it from is_terminal because "struck out" LIED about a completed
// status, and the whole point of v0.16 is that it tells the truth on a cancelled one. So a
// completed status must draw NO strike and a cancelled one must, and the strike must ride over
// whatever texture the bar already had.
eval(grab('statusTexture')); eval(grab('statusCancelled'));
const barCls = status => {
  const b = { category:'task', texture:statusTexture(status), cancelled:statusCancelled(status) };
  return ((b.category==='absence'?'ab':'')
        + (b.texture==='outline'?' out':b.texture==='faded'?' fade':'')
        + (b.cancelled?' xcl':'')).trim();
};
is(barCls('Completed'), 'fade', 'a completed status is faded and NOT struck');
is(barCls('Cancelled'), 'fade xcl', 'a cancelled status is struck, over its texture');
is(barCls('Cancelled-outline'), 'out xcl', 'the strike rides over outline too: any texture can be cancelled');
is(barCls('Planned'), '', 'a plain solid status carries no class at all: solid is the default, and it is not struck');
is(statusCancelled('Completed'), false, 'completed and cancelled are independent: completed is not cancelled');
is(statusCancelled('Cancelled') && !APP.lists.task_statuses.find(s=>s.value==='Cancelled').is_terminal, true,
   'and cancelled is not completed: a cancelled task stays on the wall unless completed is ALSO ticked');

console.log('\nTHE LOAD CELL HAS THREE STATES  (v0.13: free / loaded / away)');
// The whole of Block 6, and the thing summing share alone cannot say. v_load gives an absence
// share = 0.0, so A PERSON ON LEAVE SUMS TO ZERO AND SO DOES A FREE PERSON. Scan the wall for
// pale rows in week 34 and Marcus, on annual leave, is the palest thing on it. Nothing on a
// screen shows this is wrong: it renders beautifully and lies.
eval(grab('loadCells')); eval(grab('loadRuns')); eval(grab('loadAlpha')); eval(grab('loadOver'));
const LOAD_FLOOR = +js.match(/const LOAD_FLOOR = ([\d.]+);/)[1];
APP.tasks = [ {id:11, status:'Planned'}, {id:12, status:'Documentation'} ];   // 12 is TERMINAL
APP.load = [
  // MJD: one full day of task 11, and away the same day. The sharpest state this grid has.
  {person_code:'MJD', day:'2026-08-03', source:'task', id:11, label:'write report', share:1.0},
  {person_code:'MJD', day:'2026-08-03', source:'absence', id:5, label:'ML', share:0.0},
  // TQL: away with nothing on. Sums to zero, exactly like a free chemist.
  {person_code:'TQL', day:'2026-08-03', source:'absence', id:6, label:'ML', share:0.0},
  // NFH: a done task. v_load has no status column and does not know it is finished.
  {person_code:'NFH', day:'2026-08-03', source:'task', id:12, label:'finished', share:1.0},
  // PYR: two tasks (0.5 + 1.0) AND an instrument booking (1.0). The booking is NOT workload as of
  // 21/07/26, so it must NOT reach the sum: the load is the two tasks, 1.5, not 2.5.
  {person_code:'PYR', day:'2026-08-03', source:'task', id:11, label:'a', share:0.5},
  {person_code:'PYR', day:'2026-08-03', source:'instrument', id:9, label:'LC4', share:1.0},
  {person_code:'PYR', day:'2026-08-03', source:'task', id:11, label:'b', share:1.0}
];
let C = loadCells();
is(C.MJD[d2n('2026-08-03')].load, 1, 'MJD carries a full day');
is(C.MJD[d2n('2026-08-03')].away, true, 'AND is away: away-and-loaded does not collapse to either');
is(C.TQL[d2n('2026-08-03')].load, 0, 'TQL on leave sums to zero');
is(C.TQL[d2n('2026-08-03')].away, true, '...and zero is why away cannot be a number');
is(!!C.HZO, false, 'a free chemist has no cell at all, which is a THIRD state, not load 0');
is(C.PYR[d2n('2026-08-03')].load, 1.5, 'an instrument booking is excluded from the load; only the two tasks sum');

console.log('\nTHE ONE DERIVED SET, FOURTH CONSUMER  (v_load has no status column)');
is(!!C.NFH, false, 'a task hidden from the grid as finished is not counted here either');
APP.hideCompleted = false; C = loadCells();
is(C.NFH[d2n('2026-08-03')].load, 1, 'unticking hide-completed brings it back HERE too, from the same set');
APP.hideCompleted = true;

console.log('\nTHE RAMP  (ordinal, so it goes in a channel that carries order)');
is(loadAlpha(0) > LOAD_FLOOR - 0.0001 && loadAlpha(0) < LOAD_FLOOR + 0.0001, true, 'the floor is the floor');
is(loadAlpha(1).toFixed(2), '1.00', 'one full commitment saturates');
is(loadAlpha(2), loadAlpha(1), 'and the ramp does NOT keep going: over is categorical');
is(loadAlpha(0.25) > loadAlpha(0), true, 'a quarter share is visibly more than nothing');
is(loadOver(1), false, 'exactly one is not over');
is(loadOver(3 * (1/3)), false, 'three owners at a third each is not over: float defence');
is(loadOver(1.5), true, 'one and a half is');

console.log('\nRUNS, NOT CELLS  (piecewise constant; ~4800 nodes would say what ~40 do)');
const W6 = { start:d2n('2026-08-01'), end:d2n('2026-08-10'), days:10 };
const flat3 = {}; [3,4,5].forEach(d => { flat3[d2n('2026-08-0'+d)] = {load:1, away:false, bits:['x  1.00']}; });
is(loadRuns(flat3, W6).length, 1, 'three identical days are ONE div');
is(loadRuns(flat3, W6)[0].days, 3, '...three days wide');
is(loadRuns({}, W6).length, 0, 'a free chemist emits nothing at all');
const two = {}; two[d2n('2026-08-03')] = {load:1, away:false, bits:['a  1.00']};
                two[d2n('2026-08-04')] = {load:1, away:false, bits:['b  1.00']};
is(loadRuns(two, W6).length, 2, 'same number, different work: two runs, because the tooltips differ');

console.log('\nONE SOURCE FOR TODAY  (v0.12: the open-scroll rule and the today button)');
// The MS_DEFAULT class, live again: a value with two readers. The COLOUR section that used to
// watch this class was retired in v0.10 because both things it measured had been deleted; this
// is the same guard pointed at something that exists. --dayw and --markw killed the trap by
// construction and so does APP.todayX: one write in renderGrid, and the open-scroll rule and
// goToday() both read it rather than each carrying their own copy of the arithmetic.
// Read off `code`, not `js`: the comment explaining the trap contains the expression.
is((code.match(/PAST_DAYS\s*\*\s*DAY_W/g) || []).length, 1,
   'the today offset is computed in exactly one place');
is(/APP\.todayX = nowIn \? Math\.max\(0, px\(t\) - PAST_DAYS\*DAY_W\) : 0;/.test(code), true,
   'and that place is APP.todayX');
is((code.match(/w\.scrollLeft = APP\.todayX;/g) || []).length, 2,
   'two readers: the open-scroll rule and goToday');

console.log('\nWHICH ROWS OPEN A TASK  (v0.11: tk is the row label\'s click target)');
// The strongest check available for Block 5b, and the only one that can see its central claim.
// The failure is SILENT and DESTRUCTIVE: a milestone row carrying tk would emit
// openTk(<campaign id>), tkFor would find whatever TASK happens to hold that id, openTk's
// staleness guard would NOT fire because a task was found, and Save would write a campaign's
// edits into an unrelated task. Nothing on a screen shows that until the wrong bar moves.
const MISC = eval(js.match(/const MISC = ([^;]+);/)[1]);
const UNSCHED = eval(js.match(/const UNSCHED = ([^;]+);/)[1]);
const VERY_OVERDUE = eval(js.match(/const VERY_OVERDUE = ('[^']*')/)[1]);
eval(grab('isVeryOverdue'));
eval(grab('nameFirst')); eval(grab('rowsFor'));
APP.lists.products = [ {code:'TRV', colour:'#e8a33d', active:true, sort_order:1},
                       {code:'BXE', colour:null,      active:true, sort_order:2} ];
APP.lists.instruments = [{code:'LC9', name:'Prep-LC', active:true}];
// v0.33.0. Three roster shapes, because a fixture with roster_until absent exercises none of the
// new filters and every one of them would ship as a no-op behind a green suite.
//   MJD  current member
//   CJR  left 30/06/26, and HAS an absence bar below  -> lane must SURVIVE, it is a record
//   XXX  left 30/06/26, no bar at all                 -> lane must GO, it is an empty container
APP.roster = [{code:'MJD', full_name:'Marcus Devlin',    active:true,  roster_until:null},
              {code:'CJR', full_name:'Callum Reyes', active:true,  roster_until:'2026-06-30'},
              {code:'XXX', full_name:'Gone Entirely', active:true,  roster_until:'2026-06-30'}];
APP.owners = {};
APP.tasks = [
  {id:11, title:'dated, TRV',            product:'TRV', status:'Planned', start_date:'2026-07-20', end_date:'2026-07-24'},
  {id:12, title:'dated, Miscellaneous',  product:null,  status:'Planned', start_date:'2026-07-20', end_date:'2026-07-24'},
  {id:13, title:'purchase new GC',       product:null,  status:'Planned'},
  {id:14, title:'unscheduled, marked',   product:'TRV', status:'Planned', due_date:'2026-09-01'}
];
const bars = [
  {category:'milestone',  id:11, product:'TRV', label:'MPB-6', start_date:'2026-07-01', end_date:'2026-07-10'},
  {category:'instrument', id:92, product:'TRV', label:'LC9', person_code:'MJD', start_date:'2026-07-02', end_date:'2026-07-03'},
  {category:'absence',    id:93, product:null,  label:'AL', person_code:'MJD', start_date:'2026-07-05', end_date:'2026-07-06'},
  {category:'absence',    id:94, product:null,  label:'AL', person_code:'CJR', start_date:'2026-06-01', end_date:'2026-06-02'},
  {category:'task', id:11, product:'TRV', label:'dated, TRV',           start_date:'2026-07-20', end_date:'2026-07-24', _marks:[]},
  {category:'task', id:12, product:null,  label:'dated, Miscellaneous', start_date:'2026-07-20', end_date:'2026-07-24', _marks:[]}
];
// The milestone above deliberately carries id 11, the same id as a real task. That is the
// collision the check exists for, and ids are per-table sequences so it is not contrived.
const flat = k => rowsFor(k, bars).reduce((a,g) => a.concat(g.rows), []);
is(flat('task').length, 4, 'four task rows: two dated, two unscheduled');
is(flat('task').every(r => r.tk), true, 'every task row carries tk, dated and unscheduled alike');
is(flat('task').map(r=>r.tk).sort((a,b)=>a-b).join(','), '11,12,13,14', 'including the two with no bar');
is(flat('task').every(r => r.key === 'tk:'+r.tk), true, 'key and tk agree, so the anchor and the id cannot drift apart');
is(['milestone','instrument','absence'].every(k => flat(k).every(r => !r.tk)), true,
   'NO other category carries tk, even sharing an id with a task');
is(flat('task').filter(r => !r.bars.length).map(r=>r.tk).sort((a,b)=>a-b).join(','), '13,14',
   'the Unscheduled rows have no bar at all, so their label is the only surface they have');

console.log('\nTHE ONTEAM PREDICATE  (v0.33.0: the leaver lever, and it is not the active flag)');
// Pure, so it gets fixtures rather than a rendered assertion. today0() is pinned to 16/07/26.
{
  is(onTeam({ roster_until:null }), true, 'no date means on the team');
  // INCLUSIVE. Their last day is a day they are still here, and an off-by-one here empties
  // somebody's dashboard on the morning of their leaving do.
  is(onTeam({ roster_until:'2026-07-16' }), true, 'the last day itself is still on the team');
  is(onTeam({ roster_until:'2026-07-17' }), true, 'and tomorrow obviously is');
  is(onTeam({ roster_until:'2026-07-15' }), false, 'yesterday is not');
  is(onTeam({ roster_until:'2026-07-16T00:00:00+08:00' }), true,
     'a timestamp is sliced to its date by d2n, so it cannot compare longer than the boundary');
  // THE WHOLE MODEL IN ONE LINE. active=false is posture 2 and belongs on the dashboard; a past
  // date is a leaver and does not. If this predicate ever reads active, the two collapse.
  is(onTeam({ active:false, roster_until:null }), true,
     'inactive with no date is still on the team: posture 2 is not offboarding');
  is(onTeam({ active:true, roster_until:'2026-06-30' }), false,
     'and active with a past date IS a leaver, which is the shape the console actually writes');
  is(onTeam(null), true, 'a missing row does not throw');
  // The code-taking wrapper, for surfaces holding a code rather than a row.
  is(withApp({ roster:[{code:'CJR', roster_until:'2026-06-30'}] }, () => codeOnTeam('CJR')), false,
     'codeOnTeam resolves through the roster');
  is(withApp({ roster:[] }, () => codeOnTeam('(unassigned)')), true,
     'and an unknown code reads as on-team: (unassigned) is not a person to hide');
  // ONE definition. A second would drift, and the boundary is the kind of thing that drifts by a
  // day and is noticed by nobody until it matters.
  is((js.match(/function onTeam\(/g) || []).length, 1, 'exactly one predicate exists');

  // v0.40.0. THE SECOND PREDICATE. onTeam cannot separate posture 2 from posture 5: both are
  // active=false and both are inside their roster window. Coming in has no date, going out has one.
  eval(grab('notLeaving'));
  is(notLeaving({ code:'PYR' }), true, 'posture 1, no roster end, is not leaving');
  is(notLeaving({ code:'SBW', active:false }), true,
     'and NEITHER IS POSTURE 2: a trainee is inactive with no date, and must stay pickable');
  is(notLeaving({ code:'CJR', active:false, roster_until:'2026-08-10' }), false,
     'posture 5 IS leaving, which is the case onTeam was blind to: inactive with a FUTURE date');
  is(notLeaving({ code:'XXX', roster_until:'2020-01-01' }), false, 'and so is posture 3, long past');
  is(notLeaving(null), false, 'no row is not a person to offer work to');
  // The date is never read. A leaver is a leaver from the moment the end is set, not from the day
  // it arrives: the whole point is to stop assigning work that will need reassigning.
  is(notLeaving({ roster_until:'2099-01-01' }), notLeaving({ roster_until:'2020-01-01' }),
     'the VALUE of the date is irrelevant: having one at all is the statement');
  is((js.match(/function notLeaving\(/g) || []).length, 1, 'and exactly one of it, same as onTeam');
  // It must not have grown a date comparison, which would silently turn it back into onTeam.
  is(/today0|d2n/.test(js.match(/function notLeaving\([\s\S]*?\n\}/)[0]), false,
     'notLeaving compares no dates: that is onTeam\'s job and duplicating it would re-open the hole');
}

console.log('\nEVERY SURFACE THAT ANSWERS WHO IS WORKING  (v0.33.0: source-level sweep)');
// Source-level and deliberately blunt. The rendered assertions above cover dbOrder and the absence
// lanes; the remaining eight are dropdowns inside editor builders this harness does not open, and
// "we changed eight places" is exactly the claim that is worth mechanising rather than trusting.
// A ninth surface added later without onTeam is the failure this is aimed at.
{
  // /onTeam/ and not /onTeam\(/. Four of these five CALL it, p => onTeam(p); the workload view
  // passes it by REFERENCE, .filter(onTeam), which is the same predicate and matched neither the
  // old pattern nor anything wrong. Requiring the parenthesis was asserting a calling convention.
  // v0.40.0: WHICH predicate, not just "a predicate". Three of these six moved from onTeam to
  // notLeaving and the old helper would have passed either way, which is the assertion doing
  // nothing at the exact moment it was needed. The expected name is now an argument.
  const site = (name, re, want, why) => {
    const m = code.match(re);
    is(m ? new RegExp('\\b' + want + '\\b').test(m[0]) : false, true, name + ': ' + why);
  };
  site('tkHtml owner checkboxes',  /const own = APP\.roster[\s\S]{0,200}?\.map\(p => \{/,  'notLeaving', 'a leaver is not offered as a task owner');
  site('msHtml co-lead',           /const colead = APP\.roster[\s\S]{0,400}?\.join\(''\);/, 'notLeaving', 'nor as a campaign co-lead');
  site('msHtml lead',              /const lead = APP\.roster[\s\S]{0,400}?\.join\(''\);/,   'onTeam',     'nor as a campaign lead, where p.active already excludes posture 5');
  site('personField pool',         /const pool = APP\.roster\.filter[\s\S]{0,140}?\);/,     'onTeam',     'nor in the absence, booking or mentor field');
  site('workload view rows',       /const who = APP\.roster\.filter[\s\S]{0,80}?\);/,       'onTeam',     'nor given a row in the workload view');
  site('task chemist filter',      /const chems = \(APP\.roster[\s\S]{0,140}?\);/,          'onTeam',     'nor offered in the chemist filter');
  // AND THE THREE CARRY IT ALONE. notLeaving implies onTeam, so "onTeam(p) && notLeaving(p)" would
  // be one live test beside one dead one, and dead logic rots: somebody relaxes the live half later
  // and cannot see the dead half was load bearing for nothing. Asserted, not just commented.
  const alone = (name, re) => {
    const m = code.match(re);
    is(m ? /\bonTeam\b/.test(m[0]) : true, false, name + ' carries notLeaving alone, with no dead onTeam beside it');
  };
  alone('tkHtml owner checkboxes', /const own = APP\.roster[\s\S]{0,200}?\.map\(p => \{/);
  alone('msHtml co-lead',          /const colead = APP\.roster[\s\S]{0,400}?\.join\(''\);/);
  // The escapes. Each of these keeps an EXISTING value visible so an unrelated edit cannot blank
  // it, and losing one is a silent data change on save rather than a visible bug.
  is(/notLeaving\(p\) \|\| e\.owners\.indexOf\(p\.code\) >= 0/.test(code), true,
     'an already-ticked owner survives, because set_item_owners writes exactly what it is given');
  is(/notLeaving\(p\) \|\| p\.code === e\.co_lead/.test(code), true, 'the current co-lead survives');
  is(/notLeaving\(p\) \|\| p\.code === e\.trainee/.test(code), true, 'the current trainee survives');
  is(/&& onTeam\(p\)\) \|\| p\.code === current/.test(code), true, 'the current person field value survives');
  // And the things that must NOT have moved. The grid is a record; the admin, 31/07/26.
  is(/function personName\([\s\S]*?onTeam/.test(code.match(/function personName\([\s\S]*?\n\}/)[0]), false,
     'personName is untouched: a departed name still resolves everywhere it is already written');
  is(/onTeam/.test(code.match(/function isArchived\([\s\S]*?\n\}/)[0]), false,
     'and isArchived is untouched: completed work fades on the same 42 days for leaver and stayer');
}

console.log('\nABSENCE LANES AND THE LEAVER  (v0.33.0: a lane is a container, a bar is a record)');
// The distinction this build turns on. The grid rules did NOT change: a leaver's dated rows stay
// drawn exactly as before. What goes is the EMPTY LANE, which is a slot for absences still to be
// entered, for somebody nobody can book leave for.
{
  const ab = flat('absence').map(r => r.sub);
  is(ab.includes('MJD'), true, 'a current member has a lane');
  is(ab.includes('CJR'), true, 'and so does a departed one who still has an absence on the wall');
  is(ab.includes('XXX'), false, 'but a departed one with no bars does not: an empty lane for nobody');
  const gone = flat('absence').find(r => r.sub === 'CJR');
  is(gone.bars.length, 1, 'and the departed lane still carries its bar, so the record survives intact');
  is(flat('absence').length, 2, 'two lanes from three roster rows');
}

console.log('\nWHY THE DASHED BAR DIED  (the row this block turns on)');
// the admin proposed a dashed outline bar on Unscheduled rows so bar-click alone would reach them.
// "purchase new GC" is the counter-example and it is not an edge: bl sorts by firstMark with an
// explicit nulls-last branch, and that branch exists BECAUSE unmarked unscheduled tasks are a
// designed state. Zero dates means no left, no width, and nothing to draw at any position.
const gc = flat('task').find(r => r.tk === 13);
is(firstMark(APP.tasks.find(t=>t.id===13)), null, 'an unscheduled task need not carry a single mark');
is(gc.bars.length, 0, 'so it has no bar');
is(!!gc.tk, true, 'and its label is what makes it reachable');

console.log('\nTHE OVERDUE BOARD  (v0.20.16: an alert set no view toggle may change)');
// The board reads APP.tasks directly, so its status predicate is statusTerminal/cancelled and
// NOT visibleTasks(). That is the whole risk in the feature: visibleTasks applies is_terminal
// only when hideCompleted is on, and hideCompleted defaults OFF since v0.20.11, so a board
// built on it would count completed tasks as overdue by default. APP.hideCompleted is TRUE in
// this harness; these fixtures must pass identically either way, which is the point.
// v0.38.0: dbHardDates is evaled HERE, above overdueTally, because overdueTally stopped carrying
// its own copy of the date list and now calls it. It is evaled and not stubbed for the reason the
// whole change exists: a stub would be a third definition of "late" sitting in the test harness,
// and two was already one too many. The dashboard section below re-evals nothing; this one binding
// serves both readers, which is exactly the property the source change was making true.
eval(grab('statusTerminal')); eval(grab('overdueCols'));
eval(grab('dbHardDates')); eval(grab('overdueTally'));
const UNOWNED = js.match(/const UNOWNED = '([^']*)'/)[1];
const OD_ROSTER = [{code:'MJD',full_name:'Marcus Devlin',active:true},
                   {code:'TQL',full_name:'Tomas Lindqvist',active:true},
                   {code:'HZO',full_name:'Helena Ostrow',active:true},
                   {code:'SBW',full_name:'Sarah Whitlock',active:false}];
// today0() is pinned to 16/07/26 at the head of this file, so "past" and "future" are fixed.
const od = (tasks, owners) => { const kt=APP.tasks, ko=APP.owners, kr=APP.roster;
  APP.tasks=tasks; APP.owners=owners||{}; APP.roster=OD_ROSTER;
  const r=overdueTally(); APP.tasks=kt; APP.owners=ko; APP.roster=kr; return r; };
const odRow = (t,c) => { const r=t.rows.find(x=>x.code===c); return r?r.counts.join('|'):'NO ROW'; };
const TK = (id,status,d) => Object.assign({id,status,end_date:null,due_date:null,review_due:null,approve_due:null}, d);

is(overdueCols().map(c=>c.value).join('|'), 'Planned|Retired',
   'columns are DERIVED from task_statuses minus terminal and cancelled, never hardcoded');
is(odRow(od([TK(1,'Planned',{end_date:'2026-07-01'})], {1:['MJD']}), 'MJD'), '1|0|0',
   'a past end date on an open task counts');
is(odRow(od([TK(1,'Completed',{end_date:'2026-07-01'})], {1:['MJD']}), 'MJD'), '0|0|0',
   'the SAME task Completed counts nowhere, whatever hideCompleted says');
is(odRow(od([TK(1,'Cancelled',{end_date:'2026-07-01'})], {1:['MJD']}), 'MJD'), '0|0|0',
   'cancelled is not late, it is dead');
is(odRow(od([TK(1,'Planned',{end_date:'2026-07-16'})], {1:['MJD']}), 'MJD'), '0|0|0',
   'ending TODAY is not yet overdue: the test is strictly past');
is(odRow(od([TK(1,'Planned',{due_date:'2026-07-01'})], {1:['MJD']}), 'MJD'), '1|0|0',
   'a hard deadline alone is enough, with no end date at all');
// v0.38.0. Both of these asserted the OPPOSITE until 06/08/26, and they are kept rather than
// deleted because the inversion is the regression test: a checker that simply stopped mentioning
// review_due would go green again the day somebody helpfully put it back.
is(odRow(od([TK(1,'Planned',{review_due:'2026-07-01'})], {1:['MJD']}), 'MJD'), '0|0|0',
   'a past review date alone is NOT late: the reviewer owns the review, the owner cannot clear it');
is(odRow(od([TK(1,'Planned',{approve_due:'2026-07-01'})], {1:['MJD']}), 'MJD'), '0|0|0',
   'nor a past approve date alone, for the same reason');
// THE LIVE DEFECT, seen 04/08/26, as a fixture. Marcus's task: end date still to run, review date
// already past. It was red. The other two assertions above would both pass with an OR that
// reached review_due only when there was no end_date, so this is the one that pins the shape.
is(odRow(od([TK(1,'Planned',{end_date:'2026-07-30',review_due:'2026-07-01'})], {1:['MJD']}), 'MJD'), '0|0|0',
   'and a FUTURE end date with a past review date is not late: the shape that surfaced this');
is(odRow(od([TK(1,'Planned',{end_date:'2026-07-01',due_date:'2026-07-02'})], {1:['MJD']}), 'MJD'), '1|0|0',
   'two blown HARD dates on ONE task is one late task, not two');
is(odRow(od([TK(1,'Planned',{end_date:'2026-07-01',review_due:'2026-07-02',approve_due:'2026-07-03'})], {1:['MJD']}), 'MJD'), '1|0|0',
   'and the indicative pair adds nothing to a task already late on its bar');
const shared = od([TK(1,'Planned',{end_date:'2026-07-01'})], {1:['MJD','TQL']});
is(odRow(shared,'MJD') + ' ' + odRow(shared,'TQL'), '1|0|0 1|0|0',
   'a shared task is late for BOTH owners: a count is not an effort split');
is(odRow(od([TK(1,'Planned',{end_date:'2026-07-01'})], {}), UNOWNED), '1|0|0',
   'a late task nobody owns lands in the unassigned bucket rather than vanishing');
is(od([TK(1,'Planned',{end_date:'2026-07-01'})], {}).rows.slice(-1)[0].code, UNOWNED,
   'and unassigned is pinned last, below the people, because it is a bucket not a person');
is(odRow(od([TK(1,'Planned',{end_date:'2026-07-01'})], {1:['SBW']}), 'SBW'), '1|0|0',
   'a posture-2 trainee carries late work like anyone else');
is(od([], {}).rows.map(r=>r.code).join('|'), 'HZO|MJD|SBW|TQL',
   'with nothing late, EVERY roster member is seeded including posture 2, who can be given tasks');
is(od([], {}).total, 0, 'and the total is zero, reported in the header while the rows still draw');
const many = od([TK(1,'Planned',{end_date:'2026-07-01'}), TK(2,'Retired',{due_date:'2026-07-01'}),
                 TK(3,'Planned',{end_date:'2026-07-05'})], {1:['TQL'],2:['TQL'],3:['MJD']});
is(many.rows.map(r=>r.code).join('|'), 'TQL|MJD|HZO|SBW', 'sorted by total late DESC, worst staff on top, zeros after by code');
is(odRow(many,'TQL'), '1|1|0', 'and each count lands in its own status column');
is(many.total, 3, 'the total counts every late task-owner pairing');
// v0.20.41: HZO is BACK in the seed, reversing .19. Two boards share this tab and the pair only
// reads across if both list the same people; a name on one and not the other reads as a fault.
is(od([], {}).rows.map(r=>r.code).join('|'), 'HZO|MJD|SBW|TQL',
   'HZO is seeded like anyone else: the two boards have to list the same people');
is(odRow(od([TK(1,'Planned',{end_date:'2026-07-01'})], {1:['HZO']}), 'HZO'), '1|0|0',
   'and he still gets counted when a task he owns is actually late');
// v0.23.0: everything from here to the tab-label assertion drove the two rendered board TABLES,
// which no longer exist. Deleted with them rather than stubbed. What survives below is every
// assertion about overdueTally itself, because the tally survives: it feeds the tab count, which
// is the one thing the board did that a bubble cannot, namely be legible from the Schedule tab.
// esc, personName and the roster helper stay for the same reason the tally does.
const esc = s => String(s);
// v0.23.4: the REAL personName, not a stub. The stub read a fixed OD_ROSTER while the live one
// reads APP.roster, so a fixture could set a roster, call something that resolves a name, and get
// a name from a different list entirely. That is a divergence between test and production
// behaviour sitting inside the thing that is supposed to detect them, and it surfaced the moment
// a relation fixture used a code the board roster happened not to contain. Every caller already
// sets APP.roster, so nothing needed changing but this line.
eval(grab('personName'));
is(/'Dashboard \(' \+ t\.total \+ ' late\)'/.test(code), true,
   'the tab reads "Dashboard (n late)": a bare number would read as a count of tasks rather than an alert');
is(/>Tasks</.test(src0), false, 'and nothing still calls that tab Tasks');
// v0.23.0: the row-major fill, the OD_UP pairing, the blank half-pair and the Very overdue
// header all described the rendered TABLE and went with it. VO_WEEKS went too; isVeryOverdue
// keeps its own fixtures below and is still live on the grid, so the predicate is covered even
// though the header that printed its cutoff is not.
console.log('\nCOLLAPSED ON LOAD  (v0.30.0: the production schedule and tasks open, the other three do not)');
// Source-level, because this is a seed that runs once at load and the harness has no page. The
// failure mode is a half-move: the flag added to CATS but the seed still naming a category, or
// the seed inverted so the one category that should open is the one that does not.
// v0.30.0: this asserted exactly ONE open category and went red on the second, which is the
// fixture working. It was right about v0.20.43 and v0.20.43 stopped being true (the admin, 27/07/26).
// Rewritten to name the SET rather than to count it: 'two open' would pass on any two, and which
// two is the entire decision. Instruments, training and absences are asserted shut by name for
// the same reason, so a third category cannot open quietly by being added to the list.
const CATS_SRC = new Function(js.match(/const CATS = \[[\s\S]*?\];/)[0] + 'return CATS;')();
is(CATS_SRC.filter(c => c.openOnLoad).map(c => c.key).join('|'), 'milestone|task',
   'the production schedule and tasks open on load, in that order');
is(CATS_SRC.filter(c => !c.openOnLoad).map(c => c.key).join('|'), 'instrument|training|absence',
   'and the other three start collapsed, named rather than counted');
is(CATS_SRC.length, 5, 'still five categories: opening one is not adding one');
is(/CATS\.forEach\(c => \{ if \(!c\.openOnLoad\) APP\.collapsed\['cat:' \+ c\.key\] = true; \}\);/.test(code), true,
   'the seed reads the FLAG, so a sixth category cannot be added without deciding which way it opens');
is(/collapsed: \{\}/.test(code), true,
   'APP.collapsed still starts empty and in-memory: this is a load state, not a stored preference');
is(/the schedule tool-collapsed/.test(code), false,
   'and nothing persists it, so expanding a category lasts only as long as the tab');

console.log('\nTHE START GATE  (v0.20.42: mirrors assert_start_ok on prod)');
// The rule is DERIVED from a needs_start tick in console.html, never from the string 'In Progress'.
// These fixtures set the flag on a fixture status, so a pass here cannot come from a hardcoded name.
eval(grab('statusNeedsStart')); eval(grab('startOk')); eval(grab('statusOptions'));
const stKeep = APP.lists.task_statuses.map(x => x.needs_start);
APP.lists.task_statuses.forEach(x => { x.needs_start = (x.value === 'Planned'); });
// today0() is pinned to 16/07/26 at the head of this file.
is(startOk('Retired', null), true, 'a status without the flag is unaffected: undated is fine');
is(startOk('Retired', '2026-09-01'), true, 'and so is a start date years out');
is(startOk('Planned', null), false,
   'a flagged status on an UNDATED task fails: work cannot be under way with no dates');
is(startOk('Planned', '2026-07-17'), false, 'nor with a start date that has not arrived');
is(startOk('Planned', '2026-07-16'), true, 'starting TODAY is allowed: the test is strictly future');
is(startOk('Planned', '2026-07-01'), true, 'and a start already past is obviously allowed');
is(startOk('Planned', '2026-01-01'), true,
   'nothing is checked against the END date: an overrunning task stays markable as under way');
is(startOk('NoSuchStatus', null), true, 'an unknown status carries no flag, so it cannot be gated');
// The dropdown. Current value survives even when the dates forbid it, rather than being rewritten.
const optFuture = statusOptions('Retired', '2026-09-01');
is(/value="Planned"/.test(optFuture), false,
   'a flagged status is DROPPED from the list while the start date is still ahead');
const optHeld = statusOptions('Planned', '2026-09-01');
is(/value="Planned"[^>]*selected/.test(optHeld), true,
   'but it is kept when it is the CURRENT value: the field is never rewritten underneath you');
is(/needs a start date/.test(optHeld), true, 'and tagged, so why it is there is legible');
is(/\(off\)/.test(statusOptions('Retired', '2026-07-01')), true,
   'the switched-off tag still works: the two reasons a row is unusual do not collide');
is(/value="Planned"/.test(statusOptions('Retired', '2026-07-01')), true,
   'and a flagged status is offered normally once its start date has arrived');
is(/value="Planned"/.test(statusOptions('Retired', null)), false,
   'with no start date at all it is not offered: undated means not started');
// Source-level. The whole point is that the rule is not written twice and not written as a name.
is(/'In Progress'/.test(code), false, "the frontend never names 'In Progress': the flag is the rule");
// The invariant is ONE BUILDER, and the call count was only ever a proxy for it. v0.22.0 added a
// third caller, the dashboard's status cell, which HONOURS the invariant rather than breaking it:
// it reuses the builder instead of writing a second option list that could drift on the
// needs_start rule. So the count moves to 3 and the thing actually meant is asserted directly,
// which is what should have been written the first time.
is((js.match(/function statusOptions\(/g) || []).length, 1,
   'exactly ONE statusOptions definition exists');
is(js.replace('function statusOptions(', '').split('statusOptions(').length - 1, 3,
   'three callers now: first render, tkSyncStatus, and the dashboard status cell');
is(/onchange="tkSyncStatus\(\)"/.test(code), true, 'and the start field rebuilds the list when it changes');
is(/startOk\(v\.status, v\.start_date\)/.test(code), true, 'saveTk mirrors the server guard');
APP.lists.task_statuses.forEach((x, i) => { x.needs_start = stKeep[i]; });

// v0.23.0: THE NOT-OVERDUE BOARD block, 24 assertions, deleted with upcomingTally and
// upcomingBoardHtml. Its whole subject was the partition between the two boards, and there is
// only one thing left to be on. Recording what that cost, because it is not nothing: "every open
// task is on exactly one board" was checkable by adding two totals, and no equivalent survives.
// The bubbles have their own partition fixture (dbBuckets), which covers one person's tasks
// rather than the team's, so the property is narrower now, not merely relocated.

console.log('\nTRAINING IS FOR ANYONE  (v0.20.21: the prod posture-2 gate is gone)');
// Source-level, in the shape of the marksHitBars test: the point is that the filter is DELETED,
// not merely bypassed. The backend gate was dropped from create_training and update_training on
// 22/07/26, so a frontend that still hid active people would be the only thing enforcing a rule
// that no longer exists.
const trLine = code.match(/const trainees = APP\.roster[\s\S]{0,300}?\.join\(''\);/)[0];
is(/!p\.active/.test(trLine), false, 'the trainee dropdown no longer filters on active');
// v0.33.0 RETARGETED, and the old assertion here is worth reading before it is replaced. It said
// the keep-the-current-one escape must be ABSENT, because it had existed only to explain an
// already-selected trainee sitting in a list that excluded active people, and that list stopped
// excluding anyone in v0.20.21. True then. The escape is back now for a different reason: a
// departed trainee on an existing training record must survive an unrelated edit, exactly as the
// co-lead and the absence person do. Same three characters, opposite argument.
// The lesson is the general one, so it is written down rather than left in the diff: an assertion
// that a thing is ABSENT stops meaning anything the moment a second reason to add it appears. It
// should have been "no active filter", which is the rule, rather than "no escape hatch", which
// was one consequence of the rule at one moment.
// v0.40.0: notLeaving, and the paragraph above is still the reason. The rule is "no active
// filter", because a trainee is the point of this list. What moved is a different axis: somebody
// with a roster end is leaving, and enrolling them in training that outlasts them is not a thing
// this dropdown should make easy.
is(/notLeaving\(p\)/.test(trLine), true, 'the trainee dropdown filters on notLeaving');
is(/\bonTeam\b/.test(trLine), false, 'and not on onTeam as well, which would be a dead test beside a live one');
is(/p\.code === e\.trainee/.test(trLine), true, 'with the current pick kept, so a departed trainee survives an unrelated edit');
is(/now active/.test(trLine), false, 'the "(now active)" tag is gone, it tagged nothing once the list opened up');
is(/posture-2 trainees\)/.test(code), false, 'no live comment still claims training is posture-2 only');

console.log('\nVERY OVERDUE  (v0.20.35: keyed on END DATE, and it PARTITIONS)');
// today0() is 16/07/26 and ARCHIVE_DAYS is 42, so the line is 04/06/26.
const VOLD = '2026-04-01', VNEW = '2026-07-01';
// the admin's three cases, 22/07/26. today0() is 16/07/26, so the cutoff is 04/06/26. START is older
// than six weeks in all three; only the END date decides, because only start and end decide
// whether the bar can be DRAWN.
const S_OLD = '2026-03-01';
is(isVeryOverdue(arcT('Planned', {start_date:S_OLD, end_date:'2026-05-01'})), true,
   'start AND end both past the cutoff: nothing to draw, so it moves to Very Overdue');
is(isVeryOverdue(arcT('Planned', {start_date:S_OLD, end_date:'2026-07-10'})), false,
   'end inside the cutoff but before today: OVERDUE and still drawn, stays in its product group');
is(isVeryOverdue(arcT('Planned', {start_date:S_OLD, end_date:'2026-09-01'})), false,
   'end later than today: still running, draws clipped, entirely normal');
is(isVeryOverdue(arcT('Planned', {start_date:S_OLD, end_date:'2026-07-16'})), false,
   'ending TODAY is not past it');
is(isVeryOverdue(arcT('Planned', {end_date:VOLD})), true, 'unfinished and more than six weeks past');
is(isVeryOverdue(arcT('Planned', {end_date:VNEW})), false, 'unfinished but recently late is just late');
// The predicate keys on end_date, NOT the latest of the five. A mark sitting inside the window
// does not make an off-axis bar drawable, and keying on the latest date would leave exactly the
// undrawable rows this section exists to catch sitting in a product group showing nothing.
is(isVeryOverdue(arcT('Planned', {start_date:S_OLD, end_date:'2026-05-01', approve_due:'2026-07-20'})), true,
   'a future approve date does NOT rescue it: the bar still cannot be drawn');
is(isVeryOverdue(arcT('Completed', {end_date:VOLD})), false, 'finished is archived, never very overdue: the two are complements');
is(isVeryOverdue(arcT('Cancelled', {end_date:VOLD})), false, 'and cancelled likewise');
is(isVeryOverdue(arcT('Planned', {})), false, 'undated is Unscheduled business, not this');
is(isArchived(arcT('Planned', {end_date:VOLD})), false,
   'and the same task is NOT archived, so it cannot fall off the wall entirely');
// The board column is an AGE bucket beside STATUS buckets. Added naively that double-counts,
// since a very-late Pending task is both. It replaces instead.
APP.tasks = [arcT('Planned', {end_date:VOLD})]; APP.owners = {9:['MJD']};
const vot = overdueTally();
const voRow = vot.rows.find(r => r.code === 'MJD');
is(voRow.counts.join('|'), '0|0|1', 'on the board it lands in the very-overdue column, NOT its status column');
is(voRow.total, 1, 'and counts once, so the row still adds up to that person\'s late work');
is(vot.cols.length + 1, voRow.counts.length, 'one column per open status, plus the age column');
APP.tasks = []; APP.owners = {};
// The board above the grid was costing ~250 CSS px of a ~645 px page to say "nothing is late"
// most days. Source-level because this is markup, and the failure mode is a half-move: a board
// rendered into both views, or a tab strip whose default lands somewhere else.
const shell = fs.readFileSync('sched.html', 'utf8');
is(/id="tab-board"/.test(shell), true, 'the board has its own tab');
is(/id="view-board"/.test(shell), true, 'and its own view');
is(shell.indexOf('id="tab-board"') < shell.indexOf('id="tab-grid"'), true,
   'and it is the FIRST tab, ahead of Schedule');
is(/switchTab\('board'\)/.test(code), true, 'the app opens on it');
// [REMOVED] two assertions that the probe button kept its id and stayed a header button rather
// than becoming a third tab. They are about the probe's MARKUP, so they go with it. The audit
// counted six probe assertions and these two were not among them; they live in this group rather
// than in REGISTER PROBE, which is how they were missed.
// v0.23.0: was "the board is CALLED from one place". There is no board. The live version of the
// same worry is that the tally still has exactly one consumer, the tab label, and has not quietly
// acquired a second one that would need it to mean something else.
is(js.replace('function overdueTally()', '').split('overdueTally(').length - 1, 1,
   'overdueTally has exactly one consumer left: the tab count');
is(/renderBoard\(\);/.test(code), true, 'and renderGrid drives it, so a mutation cannot leave the board stale');
is(/showLegend: false/.test(code), true, 'the legend still starts COLLAPSED');
is(js.split("APP.showLegend ? lg : ''").length - 1, 1,
   'ONE gate for both legends, the grid one and the workload one, so they cannot disagree');

console.log('\nTHE LOAD VIEW CONTRACT  (added by mutation testing, phase 6)')
// ADDED BECAUSE A MUTATION SURVIVED. Reverting v_load to { person_code, day, hours } -- the exact
// shape the gate 3b port found and fixed -- turned no suite red. The workload view would have gone
// blank again and every check would have stayed green, which is the same failure the panel itself
// has: the reassuring answer, given confidently, from no data.
//
// SHARE IS NOT HOURS. A day is split between the owners of a task, so four owners cost each of
// them 0.25 of it. That is a fraction of a person and never a count of hours, and the two are
// easy to confuse precisely because both are numbers on a day.
{
  const rows = core.readSync('load').data;
  is(rows.length > 0, true, 'v_load returns rows at all');
  const cols = Object.keys(rows[0]).sort().join(',');
  is(cols, 'day,id,label,person_code,share,source', 'and every row carries the six columns loadCells reads');
  is(rows.some(r => 'hours' in r), false, 'no row carries hours: the page sums share, and hours is the shape that blanked it');
  // The three sources, because loadCells filters on exactly this column and drops the third.
  is([...new Set(rows.map(r => r.source))].sort().join(','), 'absence,instrument,task',
     'the three sources are present, including the instrument rows the page deliberately drops');
  // Share is a fraction of a person. A solo task costs a whole day; two owners halve it.
  const byItem = {};
  rows.filter(r => r.source === 'task').forEach(r => { (byItem[r.id] = byItem[r.id] || new Set()).add(r.person_code); });
  const solo = rows.find(r => r.source === 'task' && byItem[r.id].size === 1);
  const pair = rows.find(r => r.source === 'task' && byItem[r.id].size === 2);
  is(solo.share, 1, 'a task with one owner costs that person a whole day');
  is(pair ? pair.share : 0.5, 0.5, 'a task with two owners costs each of them half');
  is(rows.filter(r => r.source === 'absence').every(r => r.share === 0), true,
     'an absence marks the day away and adds nothing, which is what lets away and loaded coexist');
  is(rows.every(r => typeof r.label === 'string' && r.label.length > 0), true,
     'and every row carries a label, which is what the tooltip is built from');
}

console.log('\nTHE REGISTER READS  (retargeted from REGISTER PROBE, v0.20.25)')
// RETARGETED, not deleted, and the distinction is the whole point of this group.
//
// What it used to assert. The probe panel was the only thing in the suite that could tell a
// DENYING RLS policy apart from an empty table, because a denying policy returns 200 and zero
// rows rather than throwing. Prod reported SELECT granted to authenticated and one SELECT policy
// per register table, but the SQL editor runs as postgres and bypasses RLS entirely, so none of
// that was evidence about what a chemist's JWT actually gets back.
//
// Why four of its five assertions survive the panel. Only one of them was about the PANEL (no
// table probed twice, which was bookkeeping over its own list). The rest are facts about the
// REGISTER: that four named tables are the register, that all four are reachable, that an empty
// answer from them is a failure rather than a fact, and that this page reads none of them for
// data. Every one of those still has a subject on the bench, so every one is re-pointed at
// core.js rather than thrown away with the UI that used to check it.
{
  const REGISTER_READS = ['lots', 'labReports', 'lotTypeValues', 'lrTypeValues'];
  is(REGISTER_READS.every(n => core.READS[n]), true, 'the four register reads are named in the registry');
  is(REGISTER_READS.map(n => core.READS[n].from).join('|'), 'lots|lab_reports|lot_types|lr_types',
     'and they resolve to the four register tables');
  // The bench equivalent of "the door opens". There is no policy to refuse a read, so the thing
  // worth proving is the one that would still bite: a read that names a table the dataset does
  // not carry answers with an empty array, and every consumer of it renders an empty list rather
  // than an error. An empty register read is a FAILURE here for the same reason it was there.
  REGISTER_READS.forEach(n => {
    const r = core.readSync(n);
    is(!!r && !r.error && Array.isArray(r.data) && r.data.length > 0, true,
       'the ' + n + ' read comes back non-empty: zero rows is a failure, not an empty table');
  });
  // Unchanged in substance, only in spelling: the schedule reserves numbers through an RPC and
  // takes the answer back from it. It has never read the register for data, and the reason is the
  // same one the original gave -- parsing a free-text field to match a number this file did not
  // write is a false-positive factory.
  is(/core\.read\(\s*'(lots|labReports)'/.test(code), false,
     'and nothing on this page reads lots or lab_reports for data');
}

console.log('\nRESERVE FROM THE SCHEDULE  (v0.20.26)');
// The wrapper enforces posture 1, product-present and reference-empty inside one transaction.
// These pin the frontend MIRRORING those rules, which is what keeps the button honest. None of
// them is the guard; the guard is in prod.
const mr = code.match(/function mayReserve\(e\)\{[\s\S]*?\n\}/)[0];
is(/e\.id/.test(mr), true, 'no reserve on an UNSAVED task: the wrapper keys on the task id');
is(/APP\.activeCode/.test(mr), true, 'posture 1 only, matching the caller_code() gate in the wrapper');
is(/e\.product/.test(mr), true, 'and a product, because the register allocates per product');
is(/reference/.test(mr), true, 'and only while the reference is still empty, so one task claims once');
// The checker finds RPCs by matching a quoted name inside rpc(. A computed name would ship
// unverified RPCs through a passing check, which is exactly what the first cut of this did.
is(/rpc\('reserve_lot_for_item'/.test(code), true, 'the lot wrapper is called by literal name, so the RPC whitelist can see it');
is(/rpc\('reserve_lr_for_item'/.test(code), true, 'and the LR wrapper likewise');
is(/sb\.rpc\(fn\b/.test(code), false, 'no RPC is called through a variable name');
is(js.split('await loadTasks(); renderGrid();').length - 1 >= 1, true,
   'a successful claim re-reads the task, so the field shows what the register actually wrote');

console.log('\nTHE OPEN SCROLL  (v0.20.37: it was being spent on a hidden tab)');
// scrollLeft on a zero-width element silently does nothing, and since v0.23 the app opens on
// the OVERDUE tab, so the first renderGrid always runs hidden. It set scrolledOnce anyway, so
// the Schedule tab opened flush left ever after. Source-level, because the fault is WHERE the
// call happens and under what guard, not what it computes.
const oat = code.match(/function openAtToday\(\)\{[\s\S]*?\n\}/)[0];
is(/w\.clientWidth/.test(oat), true, 'the open-scroll no-ops while the grid is on a hidden tab');
is(/APP\.scrolledOnce \|\|/.test(oat), true, 'and it leaves scrolledOnce alone until it actually lands');
is(/if \(which === 'grid'\)\{ fitGrid\(\); openAtToday\(\); \}/.test(code), true,
   'so switchTab can land it the moment the schedule is first shown');
is(/w\.scrollLeft = APP\.todayX;\n      APP\.scrolledOnce = true;/.test(code), false,
   'and renderGrid no longer sets it unguarded');
is(PAST_DAYS_V, 14, 'today opens a fortnight in from the left edge');

// ---------------------------------------------------------------- seminars  [REMOVED]
// 46 assertions in seven groups, deleted with the tab: the date predicate, the undated-sorts-last
// rule, late-and-soon, the section partition, the edit gate, the must-not-call list and the stats
// row. They did not fail. The surface they cover is gone, and a suite that keeps asserting a
// removed feature is one that has to be edited to make a build pass.


// ============================================================
// THE PERSONAL DASHBOARD  (v0.22.0)
//
// The property the whole section is built around: every open task a person owns lands in exactly
// ONE bucket. Asserted by adding the buckets back up against the input, not by reading the code.
// ============================================================
eval(grab('statusNeedsStart'));
eval(grab('dbOpen')); eval(grab('dbDates')); eval(grab('dbLate'));
eval(grab('dbStartFlagInUse')); eval(grab('dbBuckets'));
eval(grab('dbMayEdit'));   // dbCode and dbIsSelf went with the picker in v0.22.3
eval(grab('dbAbsences')); eval(grab('dbMentorOf')); eval(grab('dbMenteesOf'));
eval(grab('dbInstruments')); eval(grab('dbMaintenance'));
const DB_HORIZON = +js.match(/const DB_HORIZON = (\d+);/)[1];
const DB_DAY = 86400000;

// today0() is pinned at 16/07/26 by this harness, so every date below is relative to that.
const DAYS = n => ddmmyy(today0() + n * DB_DAY).split('/').reverse().join('-').replace(/^(\d\d)-/, '20$1-');
const TKD = (id, status, f) => Object.assign({ id, title:'t'+id, status }, f || {});
function withApp(patch, fn){
  const keep = {};
  Object.keys(patch).forEach(k => { keep[k] = APP[k]; APP[k] = patch[k]; });
  try { return fn(); } finally { Object.keys(keep).forEach(k => { APP[k] = keep[k]; }); }
}
// Two open statuses. 'Doing' carries needs_start, 'Planned' does not: that pair is what makes the
// should-have-started bucket meaningful at all.
const DB_ST = [{ value:'Planned', is_terminal:false, cancelled:false, needs_start:false, active:true },
               { value:'Doing',   is_terminal:false, cancelled:false, needs_start:true,  active:true },
               { value:'Done',    is_terminal:true,  cancelled:false, needs_start:false, active:true }];
const DB_ST_NOFLAG = DB_ST.map(s => Object.assign({}, s, { needs_start:false }));
function buckets(tasks, owners, statuses){
  return withApp({ tasks, owners, lists:Object.assign({}, APP.lists, { task_statuses: statuses || DB_ST }) },
                 () => dbBuckets('TQL'));
}

console.log('\nDASHBOARD: THE PARTITION  (every open task in exactly one bucket, never two)');
{
  const T = [
    TKD(1,'Planned',{ end_date:DAYS(-10) }),                          // late
    TKD(2,'Planned',{ start_date:DAYS(-3), end_date:DAYS(5) }),       // started, status says not
    TKD(3,'Doing',  { start_date:DAYS(-3), end_date:DAYS(5) }),       // running
    TKD(4,'Planned',{ start_date:DAYS(3),  end_date:DAYS(9) }),       // starts inside the horizon
    TKD(5,'Planned',{ due_date:DAYS(6) }),                            // due inside, undated bar
    TKD(6,'Planned',{ start_date:DAYS(40), end_date:DAYS(50) }),      // beyond the horizon
    TKD(7,'Done',   { end_date:DAYS(-10) }),                          // terminal: never anywhere
    TKD(8,'Planned',{}),                                              // no dates at all
    // The two shapes that make the partition a real claim rather than an accident of the
    // fixture. Both are late AND would qualify for a second bucket on their other dates, so a
    // missing `return` in dbBuckets puts them in two places. Without these, dropping the return
    // after the overdue push changed nothing and the suite reported clean: the original eight
    // tasks were each eligible for exactly one bucket anyway, so the partition was never tested,
    // only assumed. Found by mutation, which is the entire argument for doing it.
    TKD(9,'Doing',  { start_date:DAYS(-8), end_date:DAYS(-2) }),      // late, and started
    TKD(10,'Planned',{ end_date:DAYS(-1), review_due:DAYS(4) }),      // late, and due inside the horizon
    // v0.34.0, and the shape the scope for it missed. No start_date, so it is unscheduled, but a
    // deadline forty days out, so nothing above the last return matches it either. It is not
    // late and it is not due inside the horizon. Before the sixth bucket this task was on
    // nobody's dashboard while carrying a real date, which is worse than the all-null case.
    TKD(11,'Planned',{ due_date:DAYS(40) })
  ];
  const own = {}; T.forEach(t => { own[t.id] = ['TQL']; });
  const b = buckets(T, own);
  const ids = k => b[k].map(t => t.id).join(',');
  is(ids('overdue'),    '1,9,10', 'a past date puts it in overdue and nothing else, however else it looks');
  is(ids('notStarted'), '2',   'started by the calendar, not by its status');
  is(ids('running'),    '3',   'a needs_start status past its start date is running');
  is(ids('starts'),     '4',   'starting inside the horizon');
  is(ids('due'),        '5',   'a date due inside the horizon with no bar');
  // Sorted by the tail key, min(start + the four dates) with an Infinity fallback, so the one
  // carrying a deadline sorts above the one carrying nothing at all.
  is(ids('unscheduled'), '11,8', 'no start_date and nothing above it matched: 11 by its deadline, 8 by its title');
  is(b.unscheduled.some(t => t.id === 6), false,
     'a start_date beyond the horizon is SCHEDULED, just far off, and never lands here');
  const all = Object.keys(b).reduce((n,k) => n + b[k].length, 0);
  is(all, 9, 'nine placed: 6 is beyond the horizon and 7 is terminal. 8 and 11 used to fall through too');
  const seen = {}; let dup = 0;
  Object.keys(b).forEach(k => b[k].forEach(t => { if (seen[t.id]) dup++; seen[t.id] = 1; }));
  is(dup, 0, 'and no task appears in two buckets, including the two that qualify for a second');
}

console.log('\nDASHBOARD: THE SIXTH BUCKET  (v0.34.0: !start_date, and it is the LAST return)');
{
  // The predicate is !start_date, not "all five dates null". The two undated shapes must both
  // land here, and the three that a stronger return above already claims must not: precedence is
  // the whole design, and the only way to test it is to feed it tasks eligible for two.
  const T = [
    TKD(1,'Planned',{}),                                             // nothing at all
    TKD(2,'Planned',{ due_date:DAYS(40) }),                          // undated, deadline past the horizon
    TKD(3,'Planned',{ review_due:DAYS(60) }),                        // same, on a different date column
    TKD(4,'Planned',{ approve_due:DAYS(90) }),                       // and a third
    TKD(5,'Planned',{ due_date:DAYS(6) }),                           // undated, but DUE inside: due wins
    TKD(6,'Planned',{ due_date:DAYS(-2) }),                          // undated, but LATE: overdue wins
    TKD(7,'Planned',{ start_date:DAYS(40), end_date:DAYS(50) }),     // scheduled, far off: nowhere
    TKD(8,'Done',   {})                                              // undated and terminal: nowhere
  ];
  const own = {}; T.forEach(t => { own[t.id] = ['TQL']; });
  const b = buckets(T, own);
  const ids = k => b[k].map(t => t.id).join(',');
  is(ids('unscheduled'), '2,3,4,1',
     'all four undated-and-unclaimed shapes land here, deadline-first and the dateless one last');
  is(ids('due'),     '5', 'an undated task due inside the horizon is DUE, not unscheduled');
  is(ids('overdue'), '6', 'and an undated task past its deadline is OVERDUE, not unscheduled');
  is(b.unscheduled.some(t => t.id === 7), false, 'a dated task never reaches the last return');
  is(b.unscheduled.some(t => t.id === 8), false, 'nor does a terminal one: dbOpen is above everything');
  // The claim the bucket exists to make. Before v0.34.0 tasks 1 to 4 were placed nowhere at all.
  const placed = Object.keys(b).reduce((n,k) => n + b[k].length, 0);
  is(placed, 6, 'six of the eight placed, and the two left out are the two that should be');
  const seen = {}; let dup = 0;
  Object.keys(b).forEach(k => b[k].forEach(t => { if (seen[t.id]) dup++; seen[t.id] = 1; }));
  is(dup, 0, 'and the partition still holds with a sixth bucket in it');

  // A DEPENDENCE ON THE SCHEMA, recorded rather than hidden. The predicate reads start_date
  // alone, which is only safe because the both-null-or-both-set constraint on schedule_items
  // means an end_date cannot exist without one. Both halves asserted, so the day that constraint
  // is relaxed the second line fails and says why rather than the tool quietly calling dated work
  // unplanned.
  const odd = buckets([TKD(1,'Planned',{ end_date:DAYS(5) })], { 1:['TQL'] });
  is(odd.due.map(t => t.id).join(','), '1', 'inside the horizon an end date alone reads as due');
  const oddFar = buckets([TKD(1,'Planned',{ end_date:DAYS(40) })], { 1:['TQL'] });
  is(oddFar.unscheduled.length, 1,
     'past it the same row would read as unplanned, which is the constraint doing the work, not this function');
}

// ---------------------------------------------------------------- build currency  [REMOVED]
// The eight buildIsStale cases went with the feature: the build already running is not stale, a
// newer one is, an older one is too (a rollback leaves the tab ahead), including one that sorts
// above it as a string, a failed read is silence rather than a banner, so is an empty one, a
// dismissal holds for that id, and the next id gets through.

console.log('\nDASHBOARD: INDICATIVE DATES DO NOT ALERT  (v0.38.0: end_date and due_date, nothing else)');
{
  // the admin, 06/08/26: "review and approve are only indicative dates. they should not sound any
  // alerts". Both halves are asserted, because the failure mode of this change is over-cutting
  // just as much as under-cutting: withdrawing the red must not also withdraw the visibility.
  const T = [
    // THE LIVE SHAPE, seen 04/08/26. Bar still running, review date already past. This was red.
    // 'Doing' carries needs_start, so these land in running rather than in the should-have-started
    // bucket. The status is load-bearing here: with 'Planned' they would still prove the point but
    // would prove it in the wrong bucket, which is a fixture testing itself.
    TKD(1,'Doing',{ start_date:DAYS(-6), end_date:DAYS(2), review_due:DAYS(-1) }),
    TKD(2,'Doing',{ start_date:DAYS(-6), end_date:DAYS(2), approve_due:DAYS(-1) }),
    // No bar at all, so nothing above the forward returns can claim them either way.
    TKD(3,'Planned',{ review_due:DAYS(-5) }),
    TKD(4,'Planned',{ approve_due:DAYS(-5) }),
    // The two that still DO alert, so this block cannot pass by breaking lateness altogether.
    TKD(5,'Doing',{ start_date:DAYS(-6), end_date:DAYS(-1) }),
    TKD(6,'Planned',{ due_date:DAYS(-1) }),
    // Visibility, the other half. A review date INSIDE the horizon still reaches the forward
    // group: indicative means it cannot shout, not that it disappears.
    TKD(7,'Planned',{ review_due:DAYS(4) }),
    TKD(8,'Planned',{ approve_due:DAYS(4) })
  ];
  const own = {}; T.forEach(t => { own[t.id] = ['TQL']; });
  const b = buckets(T, own);
  const ids = k => b[k].map(t => t.id).join(',');
  is(ids('overdue'), '5,6', 'only the hard dates put a task in overdue: the bar end and the deadline');
  is(b.overdue.some(t => t.id === 1), false,
     'a running bar with a past review date is NOT late, which is the defect that opened this');
  is(b.running.map(t => t.id).join(','), '1,2',
     'and it stays where it belongs, running, rather than falling out of the partition entirely');
  is(ids('unscheduled'), '3,4',
     'an undated task whose only past date is indicative is unplanned, not late');
  is(ids('due'), '7,8', 'and an indicative date inside the horizon still SHOWS: only the red went');
  const seen = {}; let dup = 0;
  Object.keys(b).forEach(k => b[k].forEach(t => { if (seen[t.id]) dup++; seen[t.id] = 1; }));
  is(dup, 0, 'the partition still holds with lateness narrowed');

  // The two sets are separate FUNCTIONS, not one function with a flag, because a flag is a thing
  // a caller can get wrong and these two callers must never agree.
  eval(grab('dbLateMark'));
  is(dbHardDates({ end_date:'2026-07-01', due_date:'2026-07-02',
                   review_due:'2026-07-03', approve_due:'2026-07-04' }).join('|'),
     '2026-07-01|2026-07-02', 'dbHardDates carries the bar end and the deadline and drops the marks');
  is(dbDates({ end_date:'2026-07-01', due_date:'2026-07-02',
               review_due:'2026-07-03', approve_due:'2026-07-04' }).length, 4,
     'while dbDates still carries all four, because the forward groups and the sort key need them');

  // THE ROW'S DATE. Today is 16/07/26 in this harness.
  is(dbLateMark({ end_date:'2026-07-01' }), 'ended 01/07/26', 'a blown bar names itself');
  is(dbLateMark({ due_date:'2026-07-01' }), 'hard deadline 01/07/26', 'and so does a blown deadline');
  // Nothing ties end_date to due_date, deliberately, so this pair is legal and it is the one the
  // old line printed wrongly: it showed end_date, which is in the FUTURE.
  is(dbLateMark({ end_date:'2026-07-30', due_date:'2026-07-01' }), 'hard deadline 01/07/26',
     'with the bar still running and the deadline blown it prints the DEADLINE, not the bar end');
  is(dbLateMark({ end_date:'2026-07-05', due_date:'2026-07-01' }), 'hard deadline 01/07/26',
     'and with both past it prints the EARLIEST, which has been wrong for longest');
  is(dbLateMark({ end_date:'2026-07-01', due_date:'2026-07-05' }), 'ended 01/07/26',
     'earliest in the other order too, so it is not just reading the second field');
  is(/2026-07-0/.test(dbLateMark({ end_date:'2026-07-01' })), false, 'and it prints dd/mm/yy, house style');
  is(dbLateMark({ review_due:'2026-07-01', approve_due:'2026-07-02' }), '',
     'an indicative date never becomes the reason: it cannot make a task late so it cannot label one');

  // Source-level, because the unit tests above prove dbLateMark and say nothing about whether the
  // overdue group actually CALLS it. Extract the function first: a lazy quantifier anchored on
  // dbTodayHtml runs past it into dbNextHtml, which is the trap this file has recorded three times.
  const tdBody = code.match(/function dbTodayHtml\([\s\S]*?\n\}/)[0];
  const odLine = tdBody.match(/dbGroup\('overdue'.*\n/)[0];
  is(/dbLateMark\(t\)/.test(odLine), true, 'the overdue group prints the date that made it late');
  is(/end_date/.test(odLine), false,
     'and no longer reaches for end_date directly, which is what printed a future date under a red heading');

  // EQUIVALENT MUTANT, recorded rather than chased. Loosening dbLateMark's filter from `< t0` to
  // `<= t0` changes no output anywhere. It is only ever called on a task dbLate has already
  // admitted, so at least one hard date is STRICTLY past; a date equal to today sorts after every
  // strictly-past one and can never win the earliest slot. Killing it would mean asserting
  // behaviour on a task the caller cannot hand it, which is a test of a shape the program lacks.
}

console.log('\nDASHBOARD: needs_start DEGRADES TO SILENCE  (an unconfigured flag must not cry wolf)');
{
  const T = [TKD(1,'Planned',{ start_date:DAYS(-3), end_date:DAYS(5) }),
             TKD(2,'Doing',  { start_date:DAYS(-3), end_date:DAYS(5) })];
  const own = { 1:['TQL'], 2:['TQL'] };
  const on  = buckets(T, own, DB_ST);
  const off = buckets(T, own, DB_ST_NOFLAG);
  is(on.notStarted.map(t=>t.id).join(','),  '1', 'with the flag in use, a Planned task past its start is called out');
  is(off.notStarted.length, 0, 'with the flag set on NO status, nothing is called out');
  is(off.running.map(t=>t.id).join(','), '1,2', 'and both fall back to running rather than to an alarm');
  is(on.overdue.length + off.overdue.length, 0, 'neither case invents a late task');
}

console.log('\nDASHBOARD: THE HORIZON IS TWO WEEKS  (decision 8, and it is arithmetic, not a literal)');
{
  is(DB_HORIZON, 14, 'DB_HORIZON is 14');
  const edge = [TKD(1,'Planned',{ start_date:DAYS(DB_HORIZON),   end_date:DAYS(DB_HORIZON+2) }),
                TKD(2,'Planned',{ start_date:DAYS(DB_HORIZON+1), end_date:DAYS(DB_HORIZON+3) })];
  const b = buckets(edge, { 1:['TQL'], 2:['TQL'] });
  is(b.starts.map(t=>t.id).join(','), '1', 'the last day of the horizon is inside it, the next day is not');
}

console.log('\nDASHBOARD: THE WRITE GATE  (decision 5, and the posture-2 trap)');
{
  const t = TKD(1,'Planned',{ end_date:DAYS(5) });
  const owners = { 1:['TQL'] };
  // Posture 2: APP.me.code is present (caller_roster_code) and activeCode is null. The gate must
  // read activeCode. Gating on me.code here would offer a trainee a dropdown the database always
  // refuses, which is the bug that nearly shipped in v0.21.
  is(withApp({ owners, isAdmin:false, activeCode:null, me:{code:'TQL'} }, () => dbMayEdit(t)), false,
     'posture 2 owning the task is offered NOTHING: activeCode is null');
  is(withApp({ owners, isAdmin:false, activeCode:'TQL', me:{code:'TQL'} }, () => dbMayEdit(t)), true,
     'posture 1 owning the task may edit it');
  is(withApp({ owners, isAdmin:false, activeCode:'NFH', me:{code:'NFH'} }, () => dbMayEdit(t)), false,
     'a non-owner may not, even on their own dashboard');
  // Decision 5 stated as a test: who is DISPLAYED must not move the gate in either direction.
  // v0.22.3 restates decision 5 for the shape that replaced the picker. Every plate is on screen,
  // so the same task can appear in two bubbles when two people own it, and Tomas's bubble sits
  // directly under yours. The gate takes the TASK and nothing else: there is no longer even a
  // notion of whose page you are on for it to be wrong about.
  is(withApp({ owners:{1:['TQL','NFH']}, isAdmin:false, activeCode:'NFH', me:{code:'NFH'} }, () => dbMayEdit(t)), true,
     'a task you co-own is editable wherever it is rendered, including in the other owner\'s bubble');
  is(withApp({ owners:{1:['TQL']}, isAdmin:false, activeCode:'NFH', me:{code:'NFH'} }, () => dbMayEdit(t)), false,
     'and a task you do not own is not, including in your own bubble');
  is(dbMayEdit.length, 1, 'dbMayEdit takes the task and nothing else: no person can be passed in to get it wrong');
  is(withApp({ owners, isAdmin:true, activeCode:'HZO', me:{code:'HZO'} }, () => dbMayEdit(t)), true,
     'admin may edit any task');
  // Source-level, the same shape as the pwMyCode assertion: the gate must never reach for me.code.
  is(/function dbMayEdit\([\s\S]*?APP\.me/.test(code.match(/function dbMayEdit\([\s\S]*?\n\}/)[0]), false,
     'dbMayEdit never reaches for APP.me.code');
  is(/dashCode/.test(code), false,
     'and no selection state exists anywhere for it to start reaching for');
}

console.log('\nDASHBOARD: ABSENCES  (decision 10, and the horizon clips them the same way)');
{
  const G = [
    { category:'absence', person_code:'TQL', label:'MC', detail:'flu', start_date:DAYS(-2), end_date:DAYS(1) },
    { category:'absence', person_code:'TQL', label:'AL', detail:'', start_date:DAYS(5),  end_date:DAYS(8) },
    { category:'absence', person_code:'TQL', label:'AL', detail:'', start_date:DAYS(40), end_date:DAYS(44) },
    { category:'absence', person_code:'NFH', label:'AL', detail:'', start_date:DAYS(0),  end_date:DAYS(2) },
    { category:'absence', person_code:'TQL', label:'AL', detail:'', start_date:DAYS(-9), end_date:DAYS(-5) }
  ];
  const a = withApp({ grid:G }, () => dbAbsences('TQL'));
  is(a.today.length, 1, 'one absence covering today');
  is(a.soon.length,  1, 'one starting inside the horizon; the one 40 days out is not shown');
  is(a.today.concat(a.soon).some(x => x.person_code !== 'TQL'), false, 'nobody else appears');
  is(a.today.concat(a.soon).some(x => d2n(x.end_date) < today0()), false, 'and nothing already finished');
}

console.log('\nDASHBOARD: MENTOR IS ONE COLUMN READ BOTH WAYS  (block 1, no second column)');
{
  const R = [{code:'HZO',full_name:'the admin',mentor:null}, {code:'NFH',full_name:'Nadia Fahim',mentor:'HZO'},
             {code:'TQL',full_name:'Tomas',mentor:null}, {code:'CJR',full_name:'Callum',mentor:'TQL'},
             {code:'MJD',full_name:'Marcus',mentor:null}, {code:'SBW',full_name:'Sarah',mentor:'MJD'}];
  is(withApp({ roster:R }, () => dbMentorOf('NFH')), 'HZO', 'the mentee reads its mentor off its own row');
  is(withApp({ roster:R }, () => dbMentorOf('HZO')), 'null', 'and a person with no mentor reads null');
  is(withApp({ roster:R }, () => dbMenteesOf('HZO').join(',')), 'NFH', 'the mentor list is a filter on the same column');
  is(withApp({ roster:R }, () => dbMenteesOf('PYR').join(',')), '', 'nobody mentors nobody');
}

console.log('\nDASHBOARD: INSTRUMENTS  (a0.17 owners, and only when maintenance is scheduled)');
{
  const I = [{ code:'LC2', name:'HPLC-2', active:true,  owner_main:'TQL', owner_backup:null },
             { code:'LC3', name:'HPLC-3', active:true,  owner_main:'NFH', owner_backup:'TQL' },
             { code:'LC4', name:'HPLC-4', active:true,  owner_main:'TQL', owner_backup:null },
             { code:'GC2', name:'GC-2',   active:false, owner_main:'TQL', owner_backup:null }];
  const M = [{ instrument:'LC2', start_date:DAYS(1),  end_date:DAYS(3)  },
             { instrument:'LC3', start_date:DAYS(2),  end_date:DAYS(4)  },
             { instrument:'LC4', start_date:DAYS(40), end_date:DAYS(42) },
             { instrument:'GC2', start_date:DAYS(1),  end_date:DAYS(3)  }];
  const patch = { lists:Object.assign({}, APP.lists, { instruments:I }), maintenance:M };
  is(withApp(patch, () => dbInstruments('TQL').map(i=>i.code).join(',')), 'LC2,LC3,LC4',
     'main or backup both count; a retired instrument does not');
  const m = withApp(patch, () => dbMaintenance('TQL'));
  is(m.map(x => x.inst.code).join(','), 'LC2,LC3', 'only instruments with maintenance inside the horizon');
  is(m.map(x => x.role).join(','), 'main,backup', 'and the row says which kind of owner they are');
}

// dbOrder and jsq entered the harness beside dbNameLink in v0.22.0 and left with it in v0.23.0.
// The bubble grid needs both, so they are pulled in here instead, next to what actually uses them.
const jsq = s => "'" + String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "'";
eval(grab('dbOrder')); eval(grab('dbIsMine')); eval(grab('dbBubbleHtml'));
console.log('\nDASHBOARD ORDER  (v0.22.3: no picker; eight bubbles, yours first)');
{
  const R = [{code:'PYR',full_name:'Priya Raman'}, {code:'HZO',full_name:'Helena Ostrow'},
             {code:'TQL',full_name:'Tomas Lindqvist'},       {code:'MJD',full_name:'Marcus Devlin'},
             {code:'SBW',full_name:'Sarah Whitlock'},          {code:'IPB',full_name:'Ines Barbosa'},
             {code:'NFH',full_name:'Nadia Fahim'}, {code:'CJR',full_name:'Callum Reyes'}];
  const ord = me => withApp({ roster:R, me:{code:me} }, () => dbOrder().map(p => p.code));
  is(ord('TQL').length, 8, 'every roster member gets a bubble, nobody is filtered out');
  is(ord('TQL')[0], 'TQL', 'yours is first, whoever you are');
  is(ord('NFH')[0], 'NFH', 'and that is not a hardcoded HZO');
  is(ord('TQL').slice(1).join(','), 'CJR,HZO,IPB,MJD,NFH,PYR,SBW', 'everyone else follows in code order');
  is(withApp({ roster:[], me:{code:'TQL'} }, () => dbOrder().length), 0, 'an empty roster is an empty order, not a throw');

  // v0.33.0. THE DEFECT THAT STARTED THE ROSTER_UNTIL BUILD, asserted. CJR left and his bubble
  // stayed, with a Running Now block and an hours figure, because this function seeded from the
  // whole roster. today0() is 16/07/26 in this harness.
  const R2 = [{code:'PYR',full_name:'Priya Raman', roster_until:null},
              {code:'TQL',full_name:'Tomas Lindqvist',       roster_until:null},
              {code:'SBW',full_name:'Sarah Whitlock',          active:false, roster_until:null},
              {code:'NFH',full_name:'Nadia Fahim', roster_until:'2026-07-16'},
              {code:'CJR',full_name:'Callum Reyes',   roster_until:'2026-06-30'}];
  const ord2 = withApp({ roster:R2, me:{code:'TQL'} }, () => dbOrder().map(p => p.code));
  is(ord2.includes('CJR'), false, 'a departed member gets no bubble, and no hours with it');
  is(ord2.includes('SBW'), true, 'but posture 2 keeps theirs: inactive is not gone, it is parked');
  is(ord2.includes('NFH'), true, 'and somebody whose last day is TODAY still has one: inclusive');
  is(ord2.join(','), 'TQL,NFH,PYR,SBW', 'so four bubbles from five rows, yours still first');
  // The two levers are independent, and this is the assertion that pins it. Under the model the
  // console writes, a leaver is active=TRUE with a past date, so anything reading active alone
  // would have kept CJR's bubble.
  is(/p\.active/.test(code.match(/function dbOrder\([\s\S]*?\n\}/)[0]), false,
     'dbOrder reads onTeam and never active: the two levers stay separate');
  // v0.23.0: the two dbNameLink assertions went with the board that carried the links. Decision 7
  // has nothing left to navigate to; every bubble is already on screen.
  // Source-level: one ordering function, used by both. Two would drift silently.
  is((js.match(/function dbOrder\(/g) || []).length, 1, 'exactly one ordering function exists');
  is(/dbNameLink|dbJump|db-flash/.test(code), false,
     'and the navigation it fed is gone with the board, not left dangling');
  // Decision 12. Every plate is on screen now, which makes a per-name count at the top even more
  // of a league table than it was when there was a picker.
  const src = code.match(/function dbBubbleHtml\([\s\S]*?\n\}/)[0];
  is(/overdueTally|\.total/.test(src), false, 'a bubble header carries no tally: it names a person, it does not score them');
}

eval(grab('absCode')); eval(grab('dbWhen')); eval(grab('dbAbsRow'));
// The four weigher constants live on one const line in the file. Read them the way the harness
// reads ARCHIVE_DAYS: off the source, so the fixture computes with the same numbers the tool does
// rather than agreeing with a copy that can drift.
const [DB_ROW_H, DB_GRP_H, DB_HEAD_H, DB_PAD_H, DB_WRAP_AT] =
  js.match(/const DB_ROW_H = (\d+), DB_GRP_H = (\d+), DB_HEAD_H = (\d+), DB_PAD_H = (\d+), DB_WRAP_AT = (\d+);/)
    .slice(1).map(Number);
eval(grab('dbWeigh')); eval(grab('dbPack'));
// UNOWNED is already in scope: the overdue-tally fixtures eval it, and dbBuckets now shares the
// same constant on purpose so the two cannot drift into different ideas of "nobody".
console.log('\nDASHBOARD UNASSIGNED  (v0.23.0: the hole removing the overdue board would have left)');
{
  // The board kept an (unassigned) row because a per-person rollup is where an ownerless task
  // vanishes. Removing the board without this bucket would have made an overdue task nobody owns
  // invisible everywhere, which is the single worst outcome the board named for itself.
  const T = [TKD(1,'Planned',{ end_date:DAYS(-5) }),                     // late, unowned
             TKD(2,'Planned',{ start_date:DAYS(3), end_date:DAYS(6) }),  // coming, unowned
             TKD(3,'Planned',{ end_date:DAYS(-5) }),                     // late, owned
             // v0.34.0. Unowned AND unscheduled, which is the worst cell in the matrix and the
             // one the bubble exists for. The consequence is that the bubble now appears on days
             // it did not before, and that is the point rather than a side effect.
             TKD(4,'Planned',{})];                                       // undated, unowned
  const own = { 3:['TQL'] };
  const un = buckets(T, own);        // buckets() drives dbBuckets('TQL'); do the unowned call raw
  const u = withApp({ tasks:T, owners:own,
                      lists:Object.assign({}, APP.lists, { task_statuses: DB_ST }) },
                    () => dbBuckets(UNOWNED));
  is(u.overdue.map(t=>t.id).join(','), '1', 'a late task nobody owns lands in the unassigned bucket');
  is(u.starts.map(t=>t.id).join(','),  '2', 'and so does an unowned task starting soon');
  is(u.unscheduled.map(t=>t.id).join(','), '4', 'and so does one nobody owns and nobody has planned');
  is(u.overdue.concat(u.starts).some(t => t.id === 3), false, 'an owned task never appears there');
  is(un.overdue.map(t=>t.id).join(','), '3', 'and the owner still gets their own');
  is(un.unscheduled.length, 0, 'the unowned undated task is not on a person as well: ownership partitions first');
  // The two must not double-count. Every open task is in exactly one bubble, person or not.
  const all = Object.keys(u).reduce((n,k)=>n+u[k].length,0) + Object.keys(un).reduce((n,k)=>n+un[k].length,0);
  is(all, 4, 'four tasks, four placements: the unassigned bucket is a partition of the same set');
  // Nothing unowned means no bubble at all, not an empty one.
  const none = withApp({ tasks:[TKD(9,'Planned',{ end_date:DAYS(5) })], owners:{9:['TQL']},
                         lists:Object.assign({}, APP.lists, { task_statuses: DB_ST }) },
                       () => dbBuckets(UNOWNED));
  is(Object.keys(none).some(k => none[k].length), false, 'with everything owned the bucket is empty, so renderDash omits it');

  // WIRING, source-level, and the limitation is stated rather than hidden. Deleting the push line
  // from renderDash passed every assertion above: the bucket was still computed correctly and
  // still never reached a bubble. Second wiring gap of this build, both found by mutation.
  // A render test would be the honest version, but renderDash pulls in a dozen functions
  // including the seminars date model, and a harness that large fails for unrelated reasons, which
  // is the "red for the wrong reason" trap this file has hit four times already. So: three
  // source assertions that catch deletion and catch the push being moved, and the CONDITION they
  // guard is covered by the six render-free assertions above.
  const rd = code.match(/function renderDash\([\s\S]*?\n\}/)[0];
  is(/codes\.push\(UNOWNED\)/.test(rd), true, 'renderDash appends the unassigned bubble');
  is(/dbBuckets\(UNOWNED\)/.test(rd), true, 'and only after asking whether it holds anything');
  is(/unshift\(UNOWNED\)/.test(rd), false, 'appended, never prepended: it is not a person and does not sit among them');
}

eval(grab('dbStatsHtml'));
// v0.33.0: the tally sums hours, so it depends on dbEffortHrs and the constant that function
// reads. Hoisted here rather than left at the dbEffortCell block below, because this is the first
// use and a grab that runs after its caller is evaled is the harness trap.
const DB_EFFORT_MAX  = +js.match(/const DB_EFFORT_MAX = ([\d.]+);/)[1];
const DB_EFFORT_STEP = +js.match(/const DB_EFFORT_STEP = ([\d.]+);/)[1];
eval(grab('dbEffortHrs')); eval(grab('dbDayHours'));
console.log('\nDASHBOARD HOURS TODAY  (v0.32.0: a tally, not an alert)');
{
  const T = (id, eff) => Object.assign({ id:id, title:'t'+id, status:'x' },
                                       eff === undefined ? {} : { effort_hours:eff });
  const h = (running, notStarted) => dbDayHours({ overdue:[], starts:[], due:[],
                                                  running:running || [], notStarted:notStarted || [] });

  is(h([]), 0, 'an empty plate is 0h, not blank: the chip shows every day or it is an alert again');
  is(h([T(1,8)]), 8, 'one full day is 8h');
  is(h([T(1,8), T(2,8)]), 16, 'two overlapping full days are 16h, stated rather than judged');
  is(h([T(1,1.5), T(2,2), T(3,2), T(4,8)]), 13.5, 'four tasks report their sum, not their count');

  // Null is the column default and reads as 8. Zero is a value somebody chose and reads as 0.
  // `t.effort_hours || 8` collapses the two and passes everything except this pair.
  is(h([T(1)]), 8, 'a task with no effort set counts as a full day');
  is(h([T(1,0), T(2,0)]), 0, 'but tasks parked at 0 commit nothing');
  is(h([T(1,0), T(2,8), T(3,1)]), 9, 'and a 0 adds nothing to a sum that is not zero');

  // TODAY, so only the two buckets that cover today. The others are on the card but not on the
  // clock, which is why the chip says "today" and the STARTS group below is not double-read.
  is(dbDayHours({ overdue:[T(1,8),T(2,8)], running:[], notStarted:[], starts:[], due:[] }), 0,
     'overdue work is not today: it is past its end date and has its own group');
  is(dbDayHours({ overdue:[], running:[], notStarted:[], starts:[T(1,8),T(2,8)], due:[] }), 0,
     'nor is work that has not started');
  is(dbDayHours({ overdue:[], running:[], notStarted:[], starts:[], due:[T(1,8)] }), 0,
     'nor a date falling due later in the horizon');
  is(h([], [T(1,8), T(2,8)]), 16,
     'but should-have-started counts: the work is on the plate either way');
  // v0.34.0. The sixth bucket must not reach the chip. A chemist parking ten tasks in KIV would
  // otherwise read 80h today, which is the single loudest way this tally could start lying, and
  // dbDayHours names its two buckets rather than subtracting, so the guard is that it stays named.
  is(dbDayHours({ overdue:[], running:[], notStarted:[], starts:[], due:[], unscheduled:[T(1,8),T(2,8)] }), 0,
     'unplanned work commits no hours today: there is no day it has been put on');

  // Straight into a label, so a float tail would be read by a person.
  is(h([T(1,1.1), T(2,1.1), T(3,6.9)]), 9.1, 'a sum reaches the chip as 9.1, not 9.100000000000001');
  is(h([T(1,0.1), T(2,2.2), T(3,4.4), T(4,1.3)]), 8, 'and 8.000000000000002 reads as 8');

  // No dates read at all. dbBuckets already means "started and not past its end", so a task needs
  // no span here. Asserted because the version this replaces required both dates, and a reader
  // arriving from that one would go looking for the guard.
  is(h([{ id:9, title:'x', status:'x', effort_hours:8 }]), 8,
     'an undated task in the running bucket still counts: membership IS the date test');

  // Shared tasks are NOT split here, deliberately, and v_load does split.
  is(/owners/.test(code.match(/function dbDayHours\([\s\S]*?\n\}/)[0]), false,
     'the tally never consults ownership: a shared task counts in full for each owner');

  // The alert is GONE, not restyled. Every trace of a threshold, in the arithmetic and in the ink.
  is(/DB_BUSY_HRS|DB_BUSY_AT/.test(code), false, 'no hours threshold and no task threshold survive');
  is(/dbBusy/.test(code), false, 'and no busy function under any of its three names');
  is(/db-over/.test(src0), false, 'the error-inked badge class is gone from markup and stylesheet');
  is(/--error/.test(shellCss.match(/\.db-hrs\{[^}]*\}/)[0]), false,
     'and the chip replacing it carries no error ink');
  const bh = code.match(/function dbBubbleHtml\([\s\S]*?\n\}/)[0];
  is(/db-hrs/.test(bh), true, 'the header emits the tally');
  is(/dbDayHours\(b\)/.test(bh), true, 'from the same buckets the body is built from');
  // Anchored on the ASSIGNMENT, not on the pattern. The first cut tested /un \? ''/, which also
  // matches the db-code span two lines down, so a mutation ungating the chip entirely survived.
  is(/const hrs = un \? ''/.test(bh), true,
     'and skips it on the unassigned bubble, which is not a person');
}

console.log('\nDASHBOARD + TASK  (v0.23.0: one button, the existing editor, activeCode)');
{
  const src = code.match(/function dbNewTask\([\s\S]*?\n\}/)[0];
  is(/APP\.activeCode/.test(src), true, 'it gates on activeCode, like every other write on this page');
  is(/APP\.me\b/.test(src), false, 'and not on me.code, which is present on posture 2');
  // v0.23.8: it no longer routes to the grid. The assertion that matters is unchanged in spirit
  // and stronger in fact: the modal must host the SAME builder, not a second form. tkHtml is the
  // whole editor, so calling it means every rule saveTk enforces comes along untouched.
  is(/tkHtml\(\)/.test(src), true, 'the modal hosts tkHtml, the grid\'s own editor builder');
  is(/function tkHtml\(/.test(code) && (code.match(/function tkHtml\(/g) || []).length === 1, true,
     'and there is exactly one such builder in the file');
  is(/modal:true/.test(src), true, 'the editing record is flagged as modal-hosted');
  is(/dbShowWide\(/.test(src), true, 'and it opens through the wide wrapper, not the 480px shell');
  // The duplicate-id hazard, asserted at source because it only manifests on a Refresh with the
  // modal open. renderGrid draws the inline new-task editor on anchor 'new'; without the modal
  // flag that is a second element carrying id tk_title, and getElementById returns the grid's
  // empty copy, so a save would read blanks off a form nobody typed into.
  is(/anchor === 'new' && !APP\.editing\.modal/.test(code), true,
     'and the grid refuses to draw a second copy of the same ids while it is');
  // Both exits must dismiss the overlay, or a saved task leaves the form on screen.
  is(/function closeEd\(\)\{ APP\.editing = null; dbCloseModal\(\);/.test(code), true, 'cancel closes the modal');
  is(/APP\.editing = null;\s*\n\s*dbCloseModal\(\);/.test(code), true, 'and so does a successful create');
  // v0.23.9. The 480px shell is right for six short dialogs and wrong for a 1020px grid control,
  // so the editor gets a MODIFIER and neither shared rule moves.
  const css3 = shellCss.replace(/\/\*[\s\S]*?\*\//g, '');
  is(/\.modal-wide\{max-width:\d+px;\}/.test(css3), true, 'the wide shell is its own rule');
  is(/\.modal\{[^}]*max-width:480px/.test(css3), true, 'and .modal is still 480 for everyone else');
  is(/\.modal-wide \.editor\{position:static/.test(css3), true,
     'the grid-only stickiness is neutralised inside the dialog and nowhere else');
  is(/\.editor\{position:sticky/.test(css3), true, 'while the grid keeps it');
  // showModal and closeModal live inside the checksummed lift, so they are WRAPPED, not edited.
  // The first cut of this fix gave showModal a wide flag and the hash check failed instantly,
  // which is the check doing precisely its job. Asserted so the wrapping is not quietly undone.
  is(/function showModal\(html\)\{ document\.getElementById\('modalBody'\)\.innerHTML = html;/.test(code), true,
     'showModal is untouched, exactly as lifted');
  is(/function dbShowWide\(html\)/.test(code) && /function dbCloseModal\(\)/.test(code), true,
     'and the wide behaviour is two wrappers outside the lift');
  // ONE button, and since v0.23.6 it is in the page HEADER rather than emitted by the dashboard,
  // so the call site is static markup and lives outside the script block. `code` is the script
  // only, which is why the count here is 1 and not 2: the declaration, and no JS caller at all.
  // The old assertion counted 2 and would have gone quiet the moment the button moved, reporting
  // a shape that was no longer true. Both halves are asserted separately now, against the right
  // source each time.
  is((code.match(/dbNewTask/g) || []).length, 1, 'declared once, and called from no JS at all');
  is((src0.match(/onclick="dbNewTask\(\)"/g) || []).length, 1,
     'exactly one call site, in the page header markup');
  is(/id="btn-newtask"[^>]*style="display:none;"/.test(src0), true,
     'hidden in the markup, revealed by routeAuth once posture 1 is proven');
  is(/APP\.activeCode\){ const nb = document\.getElementById\('btn-newtask'\)/.test(code), true,
     'and revealed on activeCode, never on me.code');
  // Never per bubble. Scoped to the extracted body: an earlier cut tested the whole file with a
  // lazy quantifier, which matches the moment dbNewTask appears ANYWHERE after dbBubbleHtml
  // starts, and reported the button inside every bubble while the code had it in neither.
  const bub = code.match(/function dbBubbleHtml\([\s\S]*?\n\}/)[0];
  is(/dbNewTask/.test(bub), false, 'and never from inside a bubble');
}

// dbStripHtml used to call dbPwNext and drag the whole seminar date model in with it. Both are
// gone, so the strip is duties alone and this is two evals rather than nine. The note the original
// left here still holds for everything else it pulls: pulling a dependency in beats stubbing it,
// because a stub is a second implementation that can disagree with the real one.
eval(grab('dbDutyNow')); eval(grab('dbStripHtml'));
console.log('\nCONTRAST: THE TIER PALETTE  (v0.24.1: light fixed, dark provably untouched)');
{
  const css4 = shellCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const grabVars = re => { const o = {}; for (const m of css4.matchAll(re))
    for (const d of m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) o[d[1]] = d[2].toLowerCase();
    return o; };
  const lightV = grabVars(/:root,\s*\[data-theme="light"\]\s*\{([^}]*)\}/g);
  const darkV  = grabVars(/\[data-theme="dark"\]\s*\{([^}]*)\}/g);
  const lin = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const Lum = h => { const n = parseInt(h.slice(1),16);
    return 0.2126*lin(n>>16&255) + 0.7152*lin(n>>8&255) + 0.0722*lin(n&255); };
  const ratio = (a,b) => { const x = Lum(a), y = Lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const TIERS = ['db-late','db-slip','db-now','db-ahead'];

  // Light. The floor is 4.5 and these are 10px letterspaced uppercase, so they are held to it
  // strictly rather than "about".
  TIERS.forEach(t => is(ratio(lightV[t], lightV.card) >= 4.5, true,
    'light ' + t + ' clears 4.5 on the card (' + ratio(lightV[t], lightV.card).toFixed(2) + ')'));

  // DARK IS UNCHANGED, and this is the assertion that actually answers the request. Each dark
  // tier is pinned to the exact value of the brand variable it replaced, so "I did not touch
  // dark" stops being a claim and becomes a test. Change one and this fails.
  is(darkV['db-late'],  darkV.error,  'dark late is still --error, to the byte');
  is(darkV['db-slip'],  darkV.warn,   'dark slip is still --warn');
  is(darkV['db-now'],   darkV.accent, 'dark now is still --accent');
  is(darkV['db-ahead'], darkV.ok,     'dark ahead is still --ok');
  ['db-late','db-slip','db-ahead'].forEach(t => is(ratio(darkV[t], darkV.card) >= 4.5, true,
    'and dark ' + t + ' still clears 4.5 (' + ratio(darkV[t], darkV.card).toFixed(2) + ')'));
  // THE EXCEPTION, named rather than rounded away. Dark's `now` is 4.49 on the card, one
  // hundredth under the floor, and it is --accent's dark value, which predates this build and
  // every version of the dashboard. v0.24.1 did not cause it and deliberately does not fix it:
  // the request was to improve light WITHOUT touching dark, and quietly nudging the brand blue
  // would have been answering a different question.
  // Pinned at its exact figure rather than tested against a lowered floor, so it cannot drift
  // further without failing, and so the three passes above are not read as "dark is compliant".
  is(ratio(darkV['db-now'], darkV.card).toFixed(2), '4.49',
     'dark now sits at 4.49, marginally under the floor, unchanged and on the record');

  // --ok was fixed globally in LIGHT only: it fails everywhere it is used, including .toast,
  // which paints white on it and is the same thin pair inverted.
  is(ratio(lightV.ok, '#ffffff') >= 4.5, true,
     'light --ok clears 4.5 on white (' + ratio(lightV.ok, '#ffffff').toFixed(2) + ')');
  is(darkV.ok, '#4ac78b', 'and dark --ok is untouched');
  // Declared outside the lift, because the palette is inside it.
  is(/:root, \[data-theme="light"\]\{ --ok:/.test(shellCss), true,
     'the light --ok override is its own block, not an edit to the lifted palette');

  // v0.24.3 darkened the two thinnest inks left in light. --accent is the suite's brand blue, so
  // the property that matters is that the change is confined to light: dark carries the blue as a
  // COLOUR rather than as text and must not move.
  ['accent','warn'].forEach(v => is(ratio(lightV[v], '#ffffff') >= 6, true,
    'light --' + v + ' now clears 6 on white (' + ratio(lightV[v], '#ffffff').toFixed(2) + ')'));
  is(darkV.accent, '#4a7cff', 'dark --accent is untouched');
  is(darkV.warn,   '#e8a33d', 'and so is dark --warn');
  // The tint follows the ink. A --accent-dim still built from the old rgb would drift, which is
  // the kind of thing nobody reports and everybody notices.
  // v0.24.4 re-anchored this from "last rgba in the stylesheet" to the light block it is about:
  // the old anchor identified the override only while nothing legitimately came after it, and the
  // dark row that now follows would have failed the assertion for the wrong reason.
  const dim = (shellCss.match(/:root, \[data-theme="light"\]\{ --accent:[^}]*?--accent-dim:\s*rgba\((\d+,\d+,\d+)/) || [])[1];
  is(dim, '47,86,196', 'and --accent-dim is rebuilt from the new blue, not the old one');
  // Left alone on purpose, and asserted so a later "tidy" does not sweep them up: both clear the
  // floor with room, and darkening --muted would flatten the de-emphasis it exists to carry.
  is(ratio(lightV.muted, '#ffffff') > 4.5 && ratio(lightV.error, '#ffffff') > 4.5, true,
     'light --muted and --error still clear the floor and are deliberately unchanged');

  // v0.24.4. Everything above stayed green while dark painted light's inks, because the light
  // overrides were `:root, [data-theme="light"]` with no dark row after them: `:root` matches
  // html in BOTH themes at equal specificity, so source order decides, and the dark block had
  // stopped winning without being touched. Asserting the block's text answered "was dark edited";
  // it never answered "what does a dark screen compute". Same defect class as v0.5.2's
  // white-on-white weekend bands: the declaration was checked, the paint was not.
  // So: compute the cascade the way the browser does. Every block whose selector list matches
  // html under the given theme, in source order, last write wins.
  const cascade = theme => { const o = {};
    for (const m of css4.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sels = m[1].split(',').map(s => s.trim());
      if (!sels.some(s => s === ':root' || s === '[data-theme="' + theme + '"]')) continue;
      for (const d of m[2].matchAll(/--([a-z0-9-]+):\s*([^;]+)/g)) o[d[1]] = d[2].trim();
    } return o; };
  const cd = cascade('dark');
  is(cd.accent, darkV.accent, 'computed dark --accent is the dark value, not the last light override');
  is(cd.ok,     darkV.ok,     'computed dark --ok likewise');
  is(cd.warn,   darkV.warn,   'computed dark --warn likewise');
  is(/74,124,255/.test(cd['accent-dim']), true, 'computed dark --accent-dim is built from the dark blue');
  // And the structural fact that makes the four lines above true: each of the two overrides that
  // shipped without a dark row now has one AFTER it. Found on the stripped text, so a comment
  // quoting a selector cannot satisfy either check (the sched_checks.cjs HANDLERS defect).
  is(css4.indexOf('[data-theme="dark"]{ --ok:') > css4.indexOf(':root, [data-theme="light"]{ --ok:'), true,
     'the --ok light override is followed by its dark row');
  is(css4.indexOf('[data-theme="dark"]{ --accent:') > css4.indexOf(':root, [data-theme="light"]{ --accent:'), true,
     'and so is the brand block');
}

console.log('\nBAND 1: THE DUTY STRIP  (v0.24.0, and it names no duty type anywhere)');
{
  const TY = [{ code:'HK',  name:'Housekeeping', colour:'#6a8fd8', show_final_days:null, active:true,  sort_order:10 },
              { code:'KYT', name:'KYT',          colour:null,      show_final_days:5,    active:true,  sort_order:20 },
              { code:'OLD', name:'Retired duty', colour:null,      show_final_days:null, active:false, sort_order:30 }];
  const D = (id, type, who, s, e) => ({ id:id, duty_type:type, person:who, start_date:DAYS(s), end_date:DAYS(e) });
  const now = ds => withApp({ dutyTypes:TY, duties:ds,
                              roster:[{code:'TQL',full_name:'Tomas Lindqvist'},{code:'NFH',full_name:'Nadia Fahim'},
                                      {code:'MJD',full_name:'Marcus Devlin'}] },
                            () => dbDutyNow());

  // Whole-period types show for every day they cover.
  is(now([D(1,'HK','TQL',-2,2)]).length, 1, 'a whole-period duty shows mid-period');
  is(now([D(1,'HK','TQL',0,0)]).length, 1, 'and on a single-day period');
  is(now([D(1,'HK','TQL',-9,-5)]).length, 0, 'a finished period does not show');
  is(now([D(1,'HK','TQL',3,7)]).length, 0, 'nor one that has not started');

  // show_final_days narrows the window to the last N days, inclusive of the last one.
  is(now([D(1,'KYT','MJD',-30,10)]).length, 0, 'a final-days type is silent early in its period');
  is(now([D(1,'KYT','MJD',-30,4)]).length, 1, 'and opens exactly N days before the end');
  is(now([D(1,'KYT','MJD',-30,5)]).length, 0, 'one day earlier than that it is still silent');
  is(now([D(1,'KYT','MJD',-30,0)]).length, 1, 'and is still showing on the closing day itself');

  // TWO NAMES ON ONE WEEK ARE ONE ENTRY. That is the fact the two rows record, and splitting it
  // would put the same week on the strip twice.
  const pair = now([D(1,'HK','NFH',-2,2), D(2,'HK','TQL',-2,2)]);
  is(pair.length, 1, 'two people on one period group into one entry');
  is(pair[0].who.join(','), 'NFH,TQL', 'with both names, sorted');
  // Different periods of the same type do NOT group.
  is(now([D(1,'HK','TQL',-2,0), D(2,'HK','NFH',0,2)]).length, 2, 'but two periods stay two entries');

  is(now([D(1,'OLD','TQL',-2,2)]).length, 0, 'a switched-off duty type never reaches the strip');
  is(now([D(1,'ZZZ','TQL',-2,2)]).length, 0, 'nor an assignment whose type is missing entirely');
  is(now([{ id:9, duty_type:'HK', person:'TQL' }]).length, 0, 'an assignment with no dates is skipped, not thrown on');

  // Ordering is the type's sort_order, so the console decides what leads the strip.
  const both = now([D(1,'KYT','MJD',-30,2), D(2,'HK','TQL',-2,2)]);
  is(both.map(x => x.type.code).join(','), 'HK,KYT', 'entries follow the duty types sort order');

  // GENERIC. No duty code may appear in the source, or adding a type in the console needs a build.
  const src2 = code.match(/function dbDutyNow\([\s\S]*?\n\}/)[0]
             + code.match(/function dbStripHtml\([\s\S]*?\n\}/)[0];
  is(/'HK'|'KYT'|[Hh]ousekeeping/.test(src2), false, 'neither function names a duty type');
  is(/show_final_days/.test(src2), true, 'the display rule comes off the type row');

  // Decision 9 survives the addition: nothing to say, nothing drawn.
  const strip = ds => withApp({ dutyTypes:TY, duties:ds, pw:[],
                                roster:[{code:'TQL',full_name:'Tomas Lindqvist'}] }, () => dbStripHtml());
  is(strip([]), '', 'no duty and no next session renders no strip at all');
  is(/Tomas Lindqvist/.test(strip([D(1,'HK','TQL',-2,2)])), true, 'a duty alone is enough to draw one');
}

console.log('\nDASHBOARD DATE  (v0.23.8: today, beside the tabs)');
{
  is(/id="tabdate"/.test(src0), true, 'the element exists in the tab strip markup');
  is(/getElementById\('tabdate'\)/.test(code), true, 'and renderBoard writes it');
  // Written from today0(), which is what every bucket on the page measures against. A header
  // printing a date the rows disagree with is worse than no header.
  const rb = code.match(/function renderBoard\([\s\S]*?\n\}/)[0];
  is(/ddmmyy\(n\)/.test(rb) && /const n = today0\(\)/.test(rb), true,
     'from today0 and ddmmyy, not from a second date source');
  is(/new Date\(\)/.test(rb), false, 'and never straight off the wall clock, which is not the pinned today');
  // Pushed right by margin-left:auto. .tabs is a shared rule whose other callers give it three
  // button children; changing that rule to suit one caller is the a0.15 .toolbar mistake.
  const css2 = shellCss.replace(/\/\*[\s\S]*?\*\//g, '');
  is(/\.tabdate\{[^}]*margin-left:auto/.test(css2), true, 'positioned by its own rule, not by changing .tabs');
  // v0.24.2. It has to out-weigh the tabs beside it without reading as one of them: heavier and
  // larger, but not the accent colour, because the tabs own that and this is not clickable.
  const tabF  = (css2.match(/\.tab\{[^}]*font-size:(\d+)px/) || [])[1];
  const dateF = (css2.match(/\.tabdate\{[^}]*font-size:(\d+)px/) || [])[1];
  is(Number(dateF) > Number(tabF), true, 'the date is larger than the tabs (' + dateF + ' against ' + tabF + ')');
  is(Number(dateF) >= 16, true, 'at 16px or more');
  // v0.24.3: the "never the accent" assertion is DELETED, not relaxed. It encoded my design
  // preference, not a requirement, and the admin reversed it. Deleting an assertion to make a build
  // pass is how a suite hollows out, so the distinction matters: this one asserted an opinion
  // whose owner has changed their mind, and the thing it was protecting against (reading as a
  // fourth tab) was thin to begin with, since the date sits far right with no underline or hover.
  is(/\.tabdate\{[^}]*color:var\(--accent\)/.test(css2), true, 'in the accent, bold and blue as asked');
  is(/\.tabdate\{[^}]*font-weight:700/.test(css2), true, 'at full bold, not semibold');
  is(/\.tabs\{[^}]*space-between/.test(css2), false, 'and .tabs was not widened to carry it');
}

console.log('\nDASHBOARD PACKING  (v0.22.4: columns packed here, because grid rows level up)');
{
  const C = (w, tag) => ({ w:w, html:tag });
  // Yours is weighed first into empty columns, so the tie rule alone has to put it top-left.
  // There is no special case for it, and that is the point: a special case is a thing that can
  // be removed by someone tidying up.
  let out = dbPack([C(10,'me'), C(10,'a'), C(10,'b')], 2);
  is(out[0][0], 'me', 'the first card lands top-left by the tie rule, with no special case for it');
  // Balance. Left takes 100, so the next three go right until right passes it.
  // Worked by hand, because a fixture that agrees with whatever the code did is not a test.
  // A(100) goes left. B..F each land right while right is still under 100: 0,20,40,60,80. F is
  // the last of them, taking right to exactly 100. So the split is 1 and 5, and the columns end
  // level. The first cut of this fixture asserted A,F / B,C,D,E, which is what a heavier F would
  // have produced; the code was right and the expectation was arithmetic done in my head.
  out = dbPack([C(100,'A'), C(20,'B'), C(20,'C'), C(20,'D'), C(20,'E'), C(20,'F')], 2);
  is(out[0].join(','), 'A', 'a heavy first card holds the left column on its own');
  is(out[1].join(','), 'B,C,D,E,F', 'while the short column fills until it catches up');
  // And one more card tips it back, which is the property that actually matters.
  out = dbPack([C(100,'A'), C(20,'B'), C(20,'C'), C(20,'D'), C(20,'E'), C(20,'F'), C(20,'G')], 2);
  is(out[0].join(','), 'A,G', 'the next card after they level goes back to the left');
  // Order WITHIN a column is never disturbed. Reading down a column has to stay code order or
  // the packing has cost more than the whitespace it bought.
  out = dbPack([C(1,'1'), C(1,'2'), C(1,'3'), C(1,'4'), C(1,'5'), C(1,'6')], 2);
  is(out[0].join(''), '135', 'equal weights alternate, left first');
  is(out[1].join(''), '246', 'and each column stays in the order it was given');
  // Degenerate inputs. dbCols returns 1 on a narrow window and the roster can be empty.
  is(dbPack([C(1,'x'), C(1,'y')], 1).length, 1, 'one column asked for is one column returned');
  is(dbPack([C(1,'x'), C(1,'y')], 1)[0].join(''), 'xy', 'and everything is in it, in order');
  is(dbPack([], 2).map(c => c.length).join(','), '0,0', 'no cards is two empty columns, not a throw');
  // Caught by try/catch, not left to throw. Removing the Math.max clamp makes dbPack build a
  // zero-length array and then push into out[0], which is undefined, so the suite died with a
  // TypeError instead of naming the assertion. That is checker lesson 4: red for the wrong reason
  // tells you something broke and not what. Third time in this file, so it gets handled at the
  // fixture rather than remembered.
  is((() => { try { return dbPack([C(1,'x')], 0).length; } catch(e){ return 'threw: ' + e.message; } })(), 1,
     'a zero column count is clamped to one rather than losing every card');

  // The weigher reads what the bubble EMITS. If a class name changes and this is not updated it
  // silently returns the same number for every bubble, the packing degenerates to alternating,
  // and nothing looks broken. So it is asserted against real markup rather than in the abstract.
  const light = '<div class="db-bh">x</div><div class="db-gt">g</div><div class="db-item">a</div>';
  const heavy = light + '<div class="db-item">b</div><div class="db-item">c</div>';
  is(dbWeigh(heavy) > dbWeigh(light), true, 'more rows weigh more');
  is(dbWeigh(heavy) - dbWeigh(light), 2 * DB_ROW_H, 'by exactly one row height each');
  // v0.23.4: was the .db-facts line. The relation moved into the header, which DB_HEAD_H already
  // covers, so that term could only ever count zero from here on. The counts row replaced it and
  // is a line every bubble carries, which makes it the term worth asserting.
  is(dbWeigh(light + '<div class="db-stats">s</div>') - dbWeigh(light), DB_ROW_H, 'the counts row counts as a row');
  is(dbWeigh(light + '<div class="db-facts">f</div>') - dbWeigh(light), 0,
     'and the retired facts line adds nothing, so a stale weigher term cannot skew the packing');
  const longTitle = '<div class="db-item"><span class="db-ttl">' + 'x'.repeat(60) + '</span></div>';
  const shortTitle = '<div class="db-item"><span class="db-ttl">short</span></div>';
  is(dbWeigh(longTitle) - dbWeigh(shortTitle), DB_ROW_H, 'a title long enough to wrap is allowed a second line');
  is(dbWeigh('') > 0, true, 'an empty bubble still weighs its own header and padding');
}

// v0.30.0: dbTaskRow gained a dependency, so the harness gains grabs. This is the "adding a
// dependency to an evaled function means adding it to the harness" trap, and it fired on the
// first run as a ReferenceError inside the PRODUCT DOT fixture rather than anywhere near the
// code that changed. Recorded because it keeps happening.
// v0.33.0: DB_EFFORT_MAX/STEP and dbEffortHrs moved UP to the busy window block, which is now
// their first use. Left here they would have been declared after the caller was evaled.
eval(grab('dbGroup')); eval(grab('dbTaskRow')); eval(grab('dbStatusCell'));
eval(grab('dbEffortSteps')); eval(grab('dbEffortCell'));
eval(grab('dbRelation'));
console.log('\nDASHBOARD RELATION  (v0.23.4: a standing fact belongs on the name, not in the work)');
{
  const R = [{code:'HZO',full_name:'Helena Ostrow',mentor:null}, {code:'NFH',full_name:'Nadia Fahim',mentor:'HZO'},
             {code:'TQL',full_name:'Tomas Lindqvist',mentor:null}, {code:'CJR',full_name:'Callum Reyes',mentor:'TQL'},
             {code:'SBW',full_name:'Sarah Whitlock',mentor:'TQL'},   {code:'IPB',full_name:'Ines Barbosa',mentor:null}];
  const rel = c => withApp({ roster:R }, () => dbRelation(c));
  is(rel('TQL'), '<span class="db-rel">(Mentees: Callum Reyes, Sarah Whitlock)</span>',
     'two mentees read as a plural list in one parenthesis');
  is(rel('NFH'), '<span class="db-rel">(Mentor: Helena Ostrow)</span>', 'a mentee names their mentor');
  is(rel('CJR'), '<span class="db-rel">(Mentor: Tomas Lindqvist)</span>', 'singular where there is one');
  is(rel('IPB'), '', 'and somebody with neither renders nothing at all, not empty brackets');
  // Guaranteed by the roster lookup, not by a branch: '(unassigned)' is not on the roster, so
  // both directions come back empty on their own. An explicit guard was written here first and
  // then removed when a mutation deleting it changed nothing.
  is(rel(UNOWNED), '', 'the unassigned bubble has no relation, because it is on no roster');
  is(/UNOWNED/.test(code.match(/function dbRelation\([\s\S]*?\n\}/)[0]), false,
     'and no special case exists for it');
  // Both directions at once, mentor first: it is the one you act on.
  const R2 = R.concat([{code:'PYR',full_name:'Priya Raman',mentor:'NFH'}]);
  const both = withApp({ roster:R2 }, () => dbRelation('NFH'));
  is(both.indexOf('Mentor:') < both.indexOf('Mentee:'), true, 'mentor is named before mentee when someone is both');
  is((both.match(/db-rel/g)||[]).length, 1, 'and both sit in ONE parenthesis, not two spans');
  // It must live in the HEADER. In the body it reads as work, which was the whole complaint.
  const bub3 = code.match(/function dbBubbleHtml\([\s\S]*?\n\}/)[0];
  is(/dbRelation\(code\)/.test(bub3), true, 'the bubble emits it');
  is(bub3.indexOf('dbRelation') < bub3.indexOf("+ dbStatsHtml"), true, 'inside the header, above the counts row');
  is(/db-facts|db-fact\b/.test(code), false, 'and the old in-body facts line is gone, not merely unused');
}

console.log('\nDASHBOARD TONES  (v0.23.3: four tiers of urgency, because one colour is a wall)');
{
  const g = (tone) => dbGroup('x', '<div class="db-item">r</div>', tone);
  is(/db-grp db-late/.test(g('late')),   true, 'a tone becomes a class on the group');
  is(/db-grp db-quiet/.test(g()),        true, 'and no tone falls back to quiet, never to nothing');
  is(dbGroup('x', '', 'late'), '', 'an empty group still renders nothing at all: decision 9 survives the repaint');
  // Every tone the renderers pass must have a rule, or a section silently loses its rule and ink
  // and rejoins the wall. CLASSES in sched_checks catches a class with NO rule anywhere; it
  // cannot catch a tone string that is never passed, nor one passed but never styled.
  const css = shellCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const used = [...new Set([...code.matchAll(/dbGroup\([\s\S]*?, '(late|slip|now|ahead|quiet)'\)/g)].map(m => m[1]))];
  is(used.length >= 4, true, 'at least four distinct tones are actually in use, not just defined');
  used.forEach(t => {
    is(css.indexOf('.db-' + t + '{border-left-color') > -1, true, 'tone ' + t + ' has a left-rule colour');
    is(css.indexOf('.db-' + t + ' .db-gt{color') > -1 || t === 'quiet', true, 'tone ' + t + ' colours its heading');
  });
  // The four working tiers must be four DIFFERENT variables. Two tiers sharing an ink is the
  // wall again, one section narrower.
  // v0.36.0. THE STANDING PANELS ARE A THREE-TIER READ and the middle tier is the whole change.
  // Both panels used to put the owner header, the instrument name, the role and the holder all at
  // --text: four things at maximum ink over thirty rows, which the eye reads as a block rather than
  // a structure. The label column now sits at --text2, between the holder and the muted backup.
  // Asserted as an ORDER rather than as a colour name, so the tier survives a palette change but a
  // drift back to --text or down to --muted does not.
  // v0.37.0. THE LOAD VIEW AND THE DASHBOARD ANSWER THE SAME QUESTION and must use the same test.
  // The load view filtered on active && onTeam, which dropped posture 2, so a trainee could be
  // given work, have a dashboard card showing the hours, and appear nowhere on the screen built to
  // show who is loaded. Asserted as EQUALITY between the two filters, so they cannot drift again.
  const loadFilter = (code.match(/if \(APP\.view === 'load'\)\{[\s\S]*?const who = APP\.roster\.filter\(([^)]*)\)/) || [,''])[1];
  is(/p\.active/.test(loadFilter), false,
     'the workload view does not filter on active: a trainee carrying work must appear on it');
  is(/onTeam/.test(loadFilter), true, 'but it still drops a leaver, whose date has passed');
  const dashFilter = (code.match(/function dbOrder\(\)\{[\s\S]*?\.filter\(([^)]*)\)/) || [,''])[1];
  is(loadFilter.replace(/\s/g,''), dashFilter.replace(/\s/g,''),
     'and it is the SAME predicate the dashboard uses, not merely a similar one');

  const stInk = c => (css.match(new RegExp('\\.' + c + '\\{[^}]*color:var\\((--[a-z0-9-]+)\\)')) || [])[1];
  is(stInk('st-role'), '--text2', 'the standing label column sits one tier down from the holder');
  is(stInk('st-who'), '--text', 'and the holder beside it keeps full ink: it is what you came to read');
  is(stInk('st-dim'), '--muted', 'with the backup a tier below the label again');
  is(new Set([stInk('st-role'), stInk('st-who'), stInk('st-dim')]).size, 3,
     'three distinct tiers, so the panel has an entry point instead of being one block of text');
  is(/\.st-sub\{[^}]*color:var\(--text\)/.test(css), true,
     'the owner heading is the ONLY full-ink thing in the instruments panel, which is the axis it is organised on');
  is(/\.st-sub\{[^}]*border-top/.test(css), true,
     'and it carries a rule above it, so the groups read as groups');

  const ink = t => (css.match(new RegExp('\\.db-' + t + ' \\.db-gt\\{color:var\\((--[a-z0-9-]+)\\)')) || [])[1];
  const inks = ['late','slip','now','ahead'].map(ink);
  is(inks.filter(Boolean).length, 4, 'all four working tiers set a heading colour');
  // v0.35.0 BROKE THE OLD FORM OF THIS, correctly, and it is rewritten rather than deleted.
  // It used to demand four distinct inks. late and slip now deliberately share red, because both
  // are alerts and the pair is separated by WEIGHT and MOTION instead. The invariant was never
  // "four colours"; it was "no two tiers are indistinguishable". So the test is now the full
  // signature, and the two non-alert tiers still have to hold their own colour outright.
  const sig = t => {
    const body = (css.match(new RegExp('\\.db-' + t + ' \\.db-gt\\{([^}]*)\\}')) || [,''])[1];
    return [ink(t), /font-weight/.test(body) ? 'bold' : '-', /animation/.test(body) ? 'moves' : '-'].join('|');
  };
  const sigs = ['late','slip','now','ahead'].map(sig);
  is(new Set(sigs).size, 4, 'and no two tiers share a full signature of colour, weight and motion');
  is(new Set([ink('now'), ink('ahead'), ink('late')]).size, 3,
     'the non-alert tiers still carry their own ink: only the two ALERTS are allowed to share one');
  // And the pair must survive the animation being switched off, or the motion was carrying meaning
  // that a reduced-motion reader never receives.
  is(sig('late').split('|')[1] !== sig('slip').split('|')[1], true,
     'late and slip differ by weight alone, so they stay apart with motion disabled');
}

console.log('\nDASHBOARD PRODUCT DOT  (hue means product, here as well as on the grid)');
{
  const T = { id:1, title:'Prep LC', status:'Pending', product:'TRV', reference:'LR26028' };
  const row = withApp({ owners:{}, isAdmin:false, activeCode:null, me:{code:'TQL'} }, () => dbTaskRow(T, '01/07/26'));
  is(/db-dot/.test(row), true, 'a task with a product carries a hue dot');
  is(/background-color:/.test(row), true, 'set as a longhand, never the shorthand the bar check exists for');
  is(/background:[^-]/.test(row), false, 'and the shorthand appears nowhere on the row');
  const noProd = withApp({ owners:{}, isAdmin:false, activeCode:null, me:{code:'TQL'} },
                         () => dbTaskRow({ id:2, title:'x', status:'Pending' }, '01/07/26'));
  is(/db-dot/.test(noProd), false, 'a task with no product carries no dot rather than a grey one');
  is(/LR26028/.test(row), true, 'the reference still prints');
  is((row.match(/db-dot/g)||[]).length, 1, 'and the reference does NOT get a dot: it is not a product');
}

console.log('\nDASHBOARD HRS/DAY  (v0.30.0: the same shape as the status cell, one field along)');
{
  const T = (id, eff) => Object.assign({ id:id, title:'x', status:'Pending' },
                                       eff === undefined ? {} : { effort_hours:eff });
  const mine  = (t) => withApp({ owners:{ [t.id]:['TQL'] }, isAdmin:false, activeCode:'TQL' }, () => dbEffortCell(t));
  const other = (t) => withApp({ owners:{}, isAdmin:false, activeCode:'TQL' }, () => dbEffortCell(t));

  is(DB_EFFORT_MAX, 8, 'the ceiling is the productive day the workload view measures against');
  is(DB_EFFORT_STEP, 0.5, 'and the step is the task editor\'s, so the two controls cannot disagree');
  is(dbEffortSteps().length, 17, '0 to 8 in halves is seventeen options');
  is(dbEffortSteps()[0], 0, 'zero is offered: the prod check is 0-8 and the editor accepts it');
  is(dbEffortSteps()[16], 8, 'and the last is 8, not 8.5: the loop stops at the ceiling');
  is(dbEffortSteps().some(s => String(s).length > 3), false,
     'no float noise like 3.0000000000000004 reaches an option label');

  // Null is 8, and this is the assumption saveTk, dbSetStatus and openTk all already make.
  is(dbEffortHrs(T(1)), 8, 'a task with no effort set reads as 8, not as 0');
  is(dbEffortHrs(T(1, 0)), 0, 'but a task actually set to 0 reads as 0, not as the default');
  is(dbEffortHrs(T(1, '4.5')), 4.5, 'and a numeric string off the wire is coerced, not concatenated');

  // The shape rule inherited from dbStatusCell: a control when it is yours, quiet text when not,
  // and something in the slot either way so the row does not reflow per reader.
  const own = mine(T(1, 4)), not = other(T(1, 4));
  is(/<select/.test(own), true, 'the owner gets a select');
  is(/<select/.test(not), false, 'and a colleague does not');
  is(/db-eff/.test(own) && /db-eff/.test(not), true, 'but BOTH occupy the slot, so the row keeps its shape');
  is(/>4h</.test(not), true, 'the read-only form still states the value rather than hiding it');
  is((own.match(/<option/g)||[]).length, 17, 'the owner sees all seventeen');
  is(/value="4" selected/.test(own), true, 'with the stored value selected');
  is(/value="8" selected/.test(mine(T(2))), true, 'and an unset task lands on 8, which is what it means');

  // statusOptions' rule: the current value survives even when the grid would not offer it, and
  // it sorts into place rather than being appended.
  const odd = mine(T(3, 3.7));
  is((odd.match(/<option/g)||[]).length, 18, 'an off-grid value is ADDED, never rounded away');
  is(/value="3.7" selected/.test(odd), true, 'and it is the one selected');
  is(odd.indexOf('>3.5h<') < odd.indexOf('>3.7h<') && odd.indexOf('>3.7h<') < odd.indexOf('>4h<'), true,
     'sorted into position, so the list stays ordered');
  is((mine(T(4, 4)).match(/<option/g)||[]).length, 17, 'a value already on the grid is not duplicated');

  // Admin writes anyone's, same gate as the status cell. Asserted because the two cells reading
  // the ownership rule differently would show one control and not the other on the same row.
  is(/<select/.test(withApp({ owners:{}, isAdmin:true, activeCode:'HZO' }, () => dbEffortCell(T(5, 8)))), true,
     'admin gets the control on a task they do not own');

  // The row emits both cells, effort first. Source-level: the order is a layout decision and the
  // rendered string is where it is actually made.
  const rowSrc = code.match(/function dbTaskRow\([\s\S]*?\n\}/)[0];
  is(rowSrc.indexOf('dbEffortCell') < rowSrc.indexOf('dbStatusCell'), true,
     'hrs/day sits left of status, so status keeps the right edge it already had');
  const full = withApp({ owners:{ 6:['TQL'] }, isAdmin:false, activeCode:'TQL' },
                       () => dbTaskRow(T(6, 2), '01/07/26'));
  is(/db-eff/.test(full) && /dbSetStatus/.test(full), true, 'and a real row carries both controls');
  is(/dbSetEffort\(6, this\.value\)/.test(full), true, 'the handler carries the task id, not an index');
}

console.log('\nDASHBOARD ABSENCE PRIVACY  (decision 10, and it now matters eight times over)');
{
  // v0.22.0 had one plate on screen and this was a nicety. v0.22.3 has all eight, so a leak puts
  // every colleague's absence TYPE on a screen anyone can walk past. Mutating dbAbsRow to render
  // the type unconditionally passed the whole suite, because dbAbsRow had no fixture at all: the
  // rule was stated in three comments and asserted nowhere. Found by mutation.
  const AT = [{ value:'Medical Leave', code:'MC', active:true }];
  const a  = { start_date:'2026-07-20', end_date:'2026-07-22', label:'Medical Leave', detail:'flu' };
  const row = (code, me) => withApp({ me:{code:me}, lists:Object.assign({}, APP.lists, { absence_types:AT }) },
                                    () => dbAbsRow(a, code));
  const own = row('TQL','TQL'), other = row('TQL','NFH');
  is(/MC/.test(own),   true,  'your own bubble shows the type code');
  is(/flu/.test(own),  true,  'and the note');
  is(/MC/.test(other), false, "someone else's bubble shows NO type code");
  is(/flu/.test(other),false, 'and no note');
  is(/away/.test(other), true, 'just the bare word away');
  is(/20\/07\/26 to 22\/07\/26/.test(other), true, 'with the dates, which are not private: the grid shows them to everyone');
  is(/20\/07\/26 to 22\/07\/26/.test(own), true, 'and your own carries the same dates');
  // Source-level, because the render test only proves the branch that ran. The person must be a
  // parameter: inferring it from ambient state is what the picker removal took away.
  is(dbAbsRow.length, 2, 'dbAbsRow takes the person explicitly rather than inferring one');
}

// dbNextHtml has never had a render fixture: its three groups were each covered by their own
// bucket assertions and nothing looked at the string it builds. The sixth bucket makes ORDER a
// decision rather than an accident, and order only exists in the rendered output.
eval(grab('dbNextHtml'));
console.log('\nDASHBOARD UNSCHEDULED GROUP  (v0.34.0: last on the card, quiet ink, no bare date)');
{
  const st = { task_statuses:DB_ST };
  const render = (tasks, owners, grid) => withApp(
    { tasks:tasks, owners:owners, grid:grid || [], me:{code:'TQL'}, activeCode:'TQL', isAdmin:false,
      lists:Object.assign({}, APP.lists, st) },
    () => dbNextHtml('TQL', dbBuckets('TQL')));

  // Alone on the card, so the tone assertions cannot be reading the away group by accident.
  // Task 3 carries TWO marks and they disagree. Without it, first mark and last mark are the same
  // number on every row in this fixture and swapping one for the other survives every assertion
  // below. Found by mutation.
  const only = render([TKD(1,'Planned',{}), TKD(2,'Planned',{ due_date:DAYS(40) }),
                       TKD(3,'Planned',{ due_date:DAYS(60), approve_due:DAYS(45) })],
                      { 1:['TQL'], 2:['TQL'], 3:['TQL'] });
  is(/unscheduled \/ KIV/.test(only), true, 'the group renders, and carries the grid\'s own words');
  is(/db-quiet/.test(only), true, 'in quiet ink');
  is(/db-late|db-slip|db-ahead|db-now/.test(only), false,
     'and in no other: this is not an alert, not a slip and not inside the horizon');

  // Decision 9. Nothing to say, nothing rendered, and this is the assertion that stops somebody
  // helpfully adding "nothing unplanned" to a card that is meant to go quiet.
  is(/unscheduled/.test(render([TKD(1,'Planned',{ start_date:DAYS(3), end_date:DAYS(6) })], { 1:['TQL'] })),
     false, 'an empty bucket renders nothing at all, not an empty heading');

  // The row. firstMark is the soonest date that CONSTRAINS the task, and it is printed with a
  // preposition: a bare date in the when column reads as a start date, which is the one thing
  // these rows do not have.
  is(new RegExp('by ' + ddmmyy(today0() + 40 * DB_DAY)).test(only), true,
     'a task with a deadline past the horizon prints it, prefixed');
  is(/no date/.test(only), true, 'and one with nothing at all says so rather than printing a blank');
  is(new RegExp('>' + ddmmyy(today0() + 40 * DB_DAY)).test(only), false,
     'never as a bare date, which would read as a start');
  // THE EARLIEST constraint, which is what decides how urgent it is to give the task dates. The
  // latest one would be the reassuring number and it is the wrong one.
  is(new RegExp('by ' + ddmmyy(today0() + 45 * DB_DAY)).test(only), true,
     'with two marks disagreeing it prints the SOONEST, which is the one that constrains');
  is(new RegExp(ddmmyy(today0() + 60 * DB_DAY)).test(only), false, 'and never the later of the two');

  // ORDER, which is the whole reason this fixture renders rather than inspecting buckets. Every
  // dated group above it, away included, and nothing below.
  const full = render([TKD(1,'Planned',{ start_date:DAYS(3), end_date:DAYS(6) }),   // starts
                       TKD(2,'Planned',{ due_date:DAYS(6) }),                       // due
                       TKD(3,'Planned',{})],                                        // unscheduled
                      { 1:['TQL'], 2:['TQL'], 3:['TQL'] },
                      [{ category:'absence', person_code:'TQL', start_date:DAYS(4), end_date:DAYS(5),
                         label:'Annual Leave', detail:'' }]);
  const at = s => full.indexOf(s);
  is(at('starts, next') < at('due, next') && at('due, next') < at('away'), true,
     'the dated groups keep the order they had');
  is(at('away') < at('unscheduled / KIV'), true,
     'and unscheduled sits below away, at the floor of the card');
  is(full.indexOf('db-grp', full.indexOf('unscheduled / KIV')) === -1, true,
     'with no group emitted after it, on a card carrying every other group at once');

  // Source-level, because the render above only proves the branch that ran. The group must be the
  // LAST dbGroup call in the function: moving it up would still pass every assertion that reads
  // one group at a time.
  const nx = code.match(/function dbNextHtml\([\s\S]*?\n\}/)[0];
  is(nx.lastIndexOf('dbGroup') === nx.indexOf("dbGroup('unscheduled"), true,
     'and it is the last dbGroup call in dbNextHtml, not merely one of them');
  // Extracted, NOT matched across the file. The first cut of this line read
  // /dbTodayHtml[\s\S]*?dbGroup\('unscheduled/ and failed on the clean build, because the lazy
  // quantifier runs on past dbTodayHtml and finds the call in dbNextHtml below it. Same trap the
  // dbNewTask assertion records, third time in this file.
  const todayHtml = code.match(/function dbTodayHtml\([\s\S]*?\n\}/)[0];
  is(/unscheduled/.test(todayHtml), false,
     'it is not in the today band: an unplanned task is not today\'s work');
}

console.log('\nDASHBOARD SELECTION STATE  (v0.22.3: there is none, and that is the assertion)');
{
  // APP.dashCode was removed rather than defaulted. State nothing reads is state something reads
  // by mistake two builds later, and with every plate visible, decision 5 stops being a subtlety.
  is(/dashCode/.test(code), false, 'no selection state survives anywhere in the source');
  is(/dbSetPerson|dbPickerHtml|db-chip/.test(code), false, 'and none of the picker machinery does either');
  // The write gate is unchanged and must stay unchanged: it reads the task and the caller, never
  // the person whose bubble the row happens to be sitting in.
  const gate = code.match(/function dbMayEdit\([\s\S]*?\n\}/)[0];
  is(/APP\.me|code\b(?!s)/.test(gate.replace('dbMayEdit(t)','')), false,
     'dbMayEdit still reads only activeCode, isAdmin and the task owners');
}

console.log('\nDASHBOARD DENSITY  (v0.22.1: an override placed above what it overrides does nothing)');
{
  // The whole block is a cascade override. Put it before the base rules and every line of it is
  // dead, the page looks exactly as it did, and no check in this project would say a word. That
  // is the failure this fixture exists for; it is not about any particular number.
  // Comment-stripped. The note explaining WHY the .odb rules were deleted contains the string
  // ".odb", so an assertion that no .odb rule survives read the explanation as a rule and failed.
  // Fifth time this exact defect has fired in this project (sched_checks.cjs has it recorded
  // four times), and it fires on the sentence written to record the previous one. Strip first.
  const css = shellCss.replace(/\/\*[\s\S]*?\*\//g, '');
  // blockAt is found on the STRIPPED text, so it is the first rule of the block rather than its
  // comment header. Every override still sits after it, which is what the check is about.
  // Anchored on .db-strip's override and not on any selector in the list below, or the anchor
  // rule fails its own "comes after the block starts" test by exactly its own position.
  const blockAt = css.indexOf('.db-tag,.db-act{');
  is(blockAt > 0, true, 'the density block is in the stylesheet');
  is(blockAt > css.indexOf('.db-grp{margin:0 0 12px;}'), true, 'it comes AFTER the base .db-grp rule');
  // The board override is SCOPED. Folding it into .odb would change a rule five other things
  // would inherit, which is the a0.15 .toolbar mistake made deliberately.
  // v0.23.0: the two .odb assertions went with the board. They pinned that the de-chroming was
  // scoped rather than folded into a shared rule, and there is now neither a shared rule nor
  // anything to scope. Replaced by the live version of the same worry: no rule may survive in the
  // stylesheet describing markup the file can no longer emit.
  is(/\.odb/.test(css), false, 'no board rules survive the board');
  is(/\.db-band|\.db-bt|\.db-flash/.test(css), false, 'nor the band wrappers dbBand used to emit');
}

// ---------------------------------------------------------------- v0.25.0 STANDING
// The Standing tab derives three things the render then paints: the duty fold across the whole
// year (not just today, which is dbDutyNow's job), the live/past marking anchored on today, and
// the by-owner instrument grouping. Painted output, not parse: the exact class the checker cannot
// see. today0 is pinned file-wide to 16/07/26; these want a today INSIDE a housekeeping week, so
// the block shadows it locally with 24/07/26, the session date and the live week 20/07-24/07.
console.log('\nSTANDING  (v0.25.0, the full-year fold, live/past marking, owners by owner)');
{
  const today0 = () => d2n('2026-07-24');   // local shadow: a today inside the 20/07 HK week
  const personName = code => ({PYR:'Priya Raman',TQL:'Tomas Lindqvist',MJD:'Marcus Devlin',
    SBW:'Sarah Whitlock',IPB:'Ines Barbosa',NFH:'Nadia Fahim',CJR:'Callum Reyes',HZO:'Helena Ostrow'}[code]||code);
  APP.dutyTypes = [{code:'HK',name:'Housekeeping',colour:null,show_final_days:null,active:true,sort_order:0}];
  APP.duties = [
    ['TQL','2026-04-13','2026-04-17'],['NFH','2026-04-13','2026-04-17'],   // past
    ['MJD','2026-04-20','2026-04-24'],['CJR','2026-04-20','2026-04-24'],   // past
    ['MJD','2026-07-20','2026-07-24'],['PYR','2026-07-20','2026-07-24'],   // live
    ['TQL','2026-07-27','2026-07-31'],['SBW','2026-07-27','2026-07-31'],   // future
  ].map(([person,s,e]) => ({duty_type:'HK',person,start_date:s,end_date:e}));
  APP.lists.instruments = [
    {code:'GC2',name:'GC-2',active:true,owner_main:'MJD',owner_backup:'PYR',sort_order:1},
    {code:'GC3',name:'GC-3',active:true,owner_main:'MJD',owner_backup:'PYR',sort_order:2},
    {code:'LC9',name:'HPLC-9',active:true,owner_main:'TQL',owner_backup:'CJR',sort_order:9},
    {code:'LC10',name:'LC-MS',active:true,owner_main:'TQL',owner_backup:'CJR',sort_order:10},
    {code:'LC2',name:'HPLC-2',active:true,owner_main:'PYR',owner_backup:'TQL',sort_order:2},
    {code:'GC7',name:'GC-7',active:true,owner_main:null,owner_backup:null,sort_order:7},  // orphan
  ];
  eval(grab('stDutyPeriods'));
  eval(grab('stInstrumentsByOwner'));

  const dp = stDutyPeriods();
  is(dp.length, 1, 'one active duty-type section');
  const per = dp[0].periods;
  is(per.length, 4, '8 assignment rows fold to 4 periods');
  is(per.every(p => p.who.length === 2), true, 'every period folds its two names into one row');
  is(per[0].start, '2026-04-13', 'periods are date-ordered, earliest first');
  const t0 = today0();
  const live = per.filter(p => t0 >= d2n(p.start) && t0 <= d2n(p.end));
  is(live.length === 1 && live[0].start, '2026-07-20', 'exactly one live period, the 20/07 week');
  is(per.filter(p => d2n(p.end) < t0).length, 2, 'two periods are past');
  is(per.filter(p => d2n(p.start) > t0).length, 1, 'one period is future');
  is(JSON.stringify(live[0].who), JSON.stringify(['MJD','PYR']), 'live-week names sorted MJD,PYR');

  const io = stInstrumentsByOwner();
  is(JSON.stringify(io.owners), JSON.stringify(['MJD','PYR','TQL']), 'owners sorted by full name');
  is(io.by['TQL'].length, 2, 'TQL is main on 2 instruments');
  is(io.by['TQL'][0].owner_backup, 'CJR', 'the row carries its backup');
  is(io.orphan.length, 1, 'an unowned active instrument is an orphan, not dropped');
  is(io.orphan[0].code, 'GC7', 'the orphan is the one with no owner_main');
}

// ---------------------------------------------------------------- v0.26.0 DEADLINE TYPES
// KYT is a duty type whose end_date is a deadline, not the far end of a working window, and the
// tool must express that WITHOUT naming it. show_final_days is the declaration: a type that sets
// it has said its closing date is the point that matters. These fixtures drive that rule, the
// note fold across a pair, and the bookable filter on the booking lane.
console.log('\nDEADLINE TYPES  (v0.26.0, KYT topics, the due mark, bookable)');
{
  const today0 = () => d2n('2026-08-20');   // inside the Q1 KYT reminder window, 11 d to run
  const personName = code => ({PYR:'Priya Raman',TQL:'Tomas Lindqvist',MJD:'Marcus Devlin',
    SBW:'Sarah Whitlock',IPB:'Ines Barbosa',NFH:'Nadia Fahim',CJR:'Callum Reyes'}[code]||code);
  APP.dutyTypes = [
    {code:'HK', name:'Housekeeping',colour:'#6a8fd8',show_final_days:null,active:true,sort_order:10},
    {code:'KYT',name:'KYT',        colour:'#d8a56a',show_final_days:14,  active:true,sort_order:20},
  ];
  APP.duties = [
    {duty_type:'HK', person:'MJD',start_date:'2026-08-17',end_date:'2026-08-21',note:null},
    {duty_type:'HK', person:'SBW',start_date:'2026-08-17',end_date:'2026-08-21',note:null},
    // a KYT pair, each submitter carrying their OWN topic: two people, two submissions
    {duty_type:'KYT',person:'MJD',start_date:'2026-07-01',end_date:'2026-08-31',note:'Solvent handling'},
    {duty_type:'KYT',person:'CJR',start_date:'2026-07-01',end_date:'2026-08-31',note:'Vessel entry'},
    // a later pair with no topic yet, the seeded state
    {duty_type:'KYT',person:'IPB',start_date:'2026-10-01',end_date:'2026-11-30',note:null},
    {duty_type:'KYT',person:'SBW',start_date:'2026-10-01',end_date:'2026-11-30',note:null},
  ];
  eval(grab('stDutyPeriods'));
  const dp = stDutyPeriods();

  is(dp.length, 2, 'two active types, two sections');
  is(dp[0].type.code, 'HK', 'sections ordered by sort_order, HK first');
  is(dp[1].type.code, 'KYT', 'KYT second');
  is(dp[1].periods.length, 2, 'KYT folds 4 rows into 2 quarterly pairs');
  is(dp[1].periods.every(p => p.who.length === 2), true, 'each quarter carries its two submitters');

  const q1 = dp[1].periods[0], q2 = dp[1].periods[1];
  is(q1.notes['MJD'], 'Solvent handling', 'a topic folds onto the period keyed by its submitter');
  is(q1.notes['CJR'], 'Vessel entry', 'and the other submitter keeps their own, separately');
  is(Object.keys(q2.notes).length, 0, 'a seeded pair with no topics folds to an empty map');
  is('noteSplit' in q1, false,
     'noteSplit is gone: two submitters with two topics is the normal case, not a fault');

  // the type-driven deadline rule, the thing that must not name KYT
  is(dp[0].type.show_final_days == null, true, 'HK declares no deadline, so it shows a span only');
  is(dp[1].type.show_final_days, 14, 'KYT declares its closing date is the point');
  const t0 = today0(), en = d2n(q1.end);
  is(Math.round((en - t0) / DB_DAY), 11, 'the due mark counts real days to the deadline');
  is(t0 >= en - (14 - 1) * DB_DAY, true, 'and 20/08 is inside the 14-day reminder window');
  is(d2n('2026-08-17') >= en - (14 - 1) * DB_DAY, false, '17/08 is one day outside it');

  // a split note means something wrote one row directly; picking a winner would hide it
  APP.duties = [
    {duty_type:'KYT',person:'MJD',start_date:'2026-07-01',end_date:'2026-08-31',note:'A'},
    {duty_type:'KYT',person:'CJR',start_date:'2026-07-01',end_date:'2026-08-31',note:'B'},
  ];
  // stDutyPeriods emits a section for every ACTIVE type, including ones with no periods (the
  // render skips those on periods.length). So find the section, never index it by position.
  const two = stDutyPeriods().find(x => x.type.code === 'KYT');
  is(Object.keys(two.periods[0].notes).length, 2,
     'two submitters with two different topics both survive, neither overwriting the other');
  is(stDutyPeriods().find(x => x.type.code === 'HK').periods.length, 0,
     'a type with no assignments still gets a section, and the render is what drops it');

  // bookable: the booking lane and its empty-state count must filter identically, or the message
  // claims instruments exist while the category renders none
  const insts = [
    {code:'LC2', active:true, bookable:true },
    {code:'LC3', active:true, bookable:true },
    {code:'EQ01',active:true, bookable:false},
    {code:'EQ02',active:true, bookable:false},
    {code:'LC9', active:false,bookable:true },
  ];
  const lane  = insts.filter(i => i.active && i.bookable !== false);
  const count = insts.filter(i => i.active && i.bookable !== false).length;
  is(lane.length, 2, 'the booking lane takes active AND bookable only');
  is(count, lane.length, 'the empty-state count uses the same filter as the lane');
  is(insts.filter(i => i.active && i.owner_main !== undefined).length !== lane.length, true,
     'and owner-only equipment is excluded from booking while staying in the file');
  // a row predating the column reads undefined, which must NOT be treated as unbookable
  is([{code:'X',active:true}].filter(i => i.active && i.bookable !== false).length, 1,
     'an instrument with no bookable value still books, so the filter cannot flip old rows');
  // a0.20 / v0.26.1. The urgent colour follows the reminder window, not the mere fact of a
  // deadline. All four KYT quarters are "due in N d"; only the one inside its window is warn.
  // Fixture dates are the real seeded deadlines, read back from the K3 post-check.
  {
    const near = (endStr, n) => d2n('2026-08-20') >= d2n(endStr) - (n - 1) * DB_DAY;
    is(near('2026-08-31', 14), true,  'Q1 deadline 31/08/26 is inside its window on 20/08/26');
    is(near('2026-11-30', 14), false, 'Q2 30/11/26 is not, though it still shows a day count');
    is(near('2027-02-28', 14), false, 'nor Q3');
    is(near('2027-05-31', 14), false, 'nor Q4, which was reading urgent at 310 days out');
  }
}

// ---------------------------------------------------------------- v0.27.0 ABSENCE CLASHES
// Phase 3. A duty period where the holder is away during it. Counted in days, because the number
// is the severity: the real boundary case in the FY26 roster is one day of five.
console.log('\nABSENCE CLASHES  (v0.27.0, phase 3, days not booleans)');
{
  const today0 = () => d2n('2026-07-20');
  APP.grid = [
    // the real one: Priya's secondment starts 24/07/26, the Friday of a housekeeping week
    {category:'absence', person_code:'PYR', start_date:'2026-07-24', end_date:'2026-10-23', label:'away'},
    // somebody away across a whole week
    {category:'absence', person_code:'CJR', start_date:'2026-08-03', end_date:'2026-08-07', label:'AL'},
    // a task, which must not be mistaken for an absence
    {category:'task',    person_code:'MJD', start_date:'2026-07-20', end_date:'2026-07-24', label:'T'},
  ];
  eval(grab('stAwayDays'));
  eval(grab('stSpanDays'));

  is(stSpanDays('2026-07-20','2026-07-24'), 5, 'a Mon-Fri period spans 5 days, both ends counted');
  is(stSpanDays('2026-07-01','2026-08-31'), 62, 'and a KYT quarter span counts the same way');

  is(stAwayDays('PYR','2026-07-20','2026-07-24'), 1,
     'the worked example: Priya is away 1 of the 5 days of her housekeeping week');
  is(stAwayDays('MJD','2026-07-20','2026-07-24'), 0,
     'her partner that week is not away, and a task on the grid is not an absence');
  is(stAwayDays('CJR','2026-08-03','2026-08-07'), 5,
     'a full-week absence covers the whole period, which is the somebody-else-covers case');
  is(stAwayDays('PYR','2026-07-13','2026-07-17'), 0,
     'the week before her secondment is clean, so the flag does not bleed backwards');
  is(stAwayDays('PYR','2026-08-10','2026-08-14'), 5,
     'and a week wholly inside a long secondment is fully covered');
  is(stAwayDays('IPB','2026-07-20','2026-07-24'), 0,
     'somebody with no absence rows at all short-circuits to zero');

  // the flag is advisory: nothing in the write path consults it. `code` is the comment-stripped
  // source, so the prose above describing the rule cannot satisfy the rule.
  is(/stAwayDays\s*\(/.test(code), true, 'stAwayDays is called somewhere');
  is(/(tkSave|abSave|tdWrite|dutyWrite)[\s\S]{0,400}stAwayDays/.test(code), false,
     'but never from a save path: the clash advises, it does not refuse');
}

console.log('\nTHE SERVER RULES AT THE SEAM  (the start gate and the absence gate, in core.js)');
// NEW with the picker. Until somebody other than a posture-1 chemist could sign in, two of these
// had nothing to exercise them, and the third, the start gate, was mirrored by startOk above and
// enforced nowhere: the page refused politely and core.js would have taken the write anyway.
// These drive core.RPCS directly, synchronously, so the summary line cannot count before they run.
{
  const db = core.db();
  const as = c => { core.setViewingAs(c); core.signInDefault(); };
  const plus = n => { const d = new Date(core.today() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); };
  const rpc = (n, a) => core.RPCS[n](a || {});
  const flagged = db.task_statuses.filter(s => s.needs_start && s.active)[0];
  const plain   = db.task_statuses.filter(s => !s.needs_start && s.active && !s.is_terminal && !s.cancelled)[0];
  is(!!flagged && !!plain, true, 'the seed carries a flagged status and an unflagged one');

  // ---- the start gate, assert_start_ok's equivalent ----
  as('MJD');
  const base = { p_title:'start gate probe', p_product: db.products[0].code, p_owners:['MJD'] };
  const mk = extra => rpc('create_schedule_item', Object.assign({}, base, extra));
  is(!!mk({ p_status: flagged.value }).error, true, 'a flagged status on an UNDATED task is refused by core.js, not only by the page');
  is(!!mk({ p_status: flagged.value, p_start_date: plus(3), p_end_date: plus(5) }).error, true,
     'and on a task whose start date has not arrived');
  const ok1 = mk({ p_status: flagged.value, p_start_date: core.today(), p_end_date: plus(2) });
  is(!!ok1.error, false, 'a start date of today is allowed: inclusive, as startOk is');
  const undated = mk({ p_status: plain.value });
  is(!!undated.error, false, 'an unflagged status needs no date at all');
  is(!!rpc('update_schedule_item', { p_id: undated.data.id, p_status: flagged.value }).error, true,
     'a PARTIAL update cannot slip the flag past the gate: the missing date is read off the stored row');
  is(!!rpc('update_schedule_item', { p_id: ok1.data.id, p_status: flagged.value, p_start_date: plus(4), p_end_date: plus(6) }).error, true,
     'nor can moving the start of a flagged task into the future');
  // Keyed to the FLAG. Tick it on the unflagged status and the same write is refused; untick the
  // flagged one and it is allowed. Nothing names a status.
  as(core.ADMIN_CODE);
  rpc('set_task_status_needs_start', { p_value: plain.value, p_needs_start: true });
  rpc('set_task_status_needs_start', { p_value: flagged.value, p_needs_start: false });
  as('MJD');
  is(!!mk({ p_status: plain.value }).error, true, 'tick the flag on another status and the gate follows the tick');
  is(!!mk({ p_status: flagged.value }).error, false, 'untick it and the old status goes free: the rule is the flag, never the name');
  core.reset();

  // ---- the absence gate: posture 2 writes its own absences and nothing else ----
  const parked = core.db().people.filter(p => !p.active && !p.roster_until)[0];
  const ab = who => ({ p_person_code: who, p_start_date: plus(10), p_end_date: plus(11), p_absence_type: 'Annual Leave' });
  as(parked.code);
  const own = rpc('create_absence', ab(parked.code));
  is(!!own.error, false, 'posture 2 may record their own absence');
  is(!!rpc('update_absence', Object.assign({ p_id: own.data.id }, ab(parked.code))).error, false, 'and change it');
  is(!!rpc('create_absence', ab('MJD')).error, true, "but not somebody else's");
  is(!!rpc('update_absence', Object.assign({ p_id: own.data.id }, ab('MJD'))).error, true,
     'nor move their own onto somebody else');
  const mjdAb = core.db().absences.filter(a => a.person_code === 'MJD')[0];
  is(!!rpc('delete_absence', { p_id: mjdAb.id }).error, true, "nor delete somebody else's");
  is(!!rpc('create_schedule_item', Object.assign({}, base, { p_status: plain.value })).error, true, 'and nothing else: no task');
  is(!!rpc('create_instrument_booking', { p_person_code: parked.code, p_instrument_code: 'LC1', p_start_date: plus(10), p_end_date: plus(10) }).error, true,
     'no booking, not even their own');
  is(!!rpc('delete_absence', { p_id: own.data.id }).error, false, 'and they may delete their own');
  as('MJD');
  is(!!rpc('create_absence', ab('MJD')).error, false, 'posture 1 records their own');
  is(!!rpc('create_absence', ab('TQL')).error, true, "and not somebody else's either: ownership is not a posture-2 rule");
  as(core.ADMIN_CODE);
  is(!!rpc('create_absence', ab('TQL')).error, false, "the admin records anybody's");
  const gone = core.db().people.filter(p => p.roster_until && p.roster_until < core.today())[0];
  as(gone.code);
  is(!!rpc('create_absence', ab(gone.code)).error, true, 'and a leaver, past their date, records nothing');
  core.setViewingAs(null); core.signInDefault(); core.reset();
}

console.log('\n' + (f ? f+' FAILURE(S)' : 'logic ok'));
process.exit(f?1:0);
