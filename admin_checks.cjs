// admin_checks.cjs  -  a0.17. The first test suite console.html has ever had.
//
// Handover open item 3: "console.html is the largest untested surface in the project and Phase 1
// adds three more panels to it." This is not that suite. It is the smallest thing that would
// have caught BOTH a0.15 defects, plus the one this build could plausibly introduce.
//
// What it asserts, and why each one exists:
//   1. CLASSES        every class emitted by the JS has a CSS rule. .rowsel is new in a0.17.
//   2. COLUMN COUNTS  every table.data the renderers produce has the same number of cells in
//                     every row as it has headers. a0.17 widened two tables and added one;
//                     a miscounted colspan or a missing <td> in an addrow is invisible on a
//                     screenshot until the column it shifts is the one you were reading.
//   3. TOOLBAR        .toolbar is space-between and every caller must give it exactly two
//                     children. This is the a0.15 defect, asserted rather than remembered.
//   4. RPC SURFACE    every RPC name console.html calls is on a list verified against prod, AND
//                     is implemented behind the seam. The second half is new in the port.
//
// PORTED, not rewritten, alongside the page. Three groups changed and one died:
//   RPC SURFACE     the whitelist is now checked against core.js as well as against the page.
//                   The four seminar RPCs came off it with the panel. This assertion earned
//                   itself immediately: it found three reorder RPCs the page calls and core.js
//                   did not implement, so every up/down arrow on the setup tables was dead.
//   ABSENCE MARKER  the v_grid projection and the absence filter moved into the registry, so
//                   the assertion follows them there instead of reading the page's own select.
//   SELECTORS       pwOwnerOptions is gone with the seminar panel; the rule it carried is
//                   unchanged and still asserted on ownerOptionsAdmin.
//   BUILD CURRENCY  deleted outright, 16 assertions, with the feature.
// Two groups are new: READ SURFACE and SHARED COLUMN SETS, both at the seam.
//
// The extractor also gained a fifth mode. Its stated regex-literal gap was not theoretical: it
// had always misread esc(), and only an accident of quote counts downstream hid that. Removing
// the seminar panel removed the accident. Written up at grab().
//
// Run: node admin_checks.cjs console.html
//
// No 'use strict'. A strict-mode eval gets its own scope, so every function declaration would
// be created and discarded and the harness would report "renderRoster is not defined" instead
// of anything about console.html. the schedule logic suite relies on the same sloppy-mode behaviour.
const fs = require('fs');
// The page's own functions now reach core.now() and core.ADMIN_CODE, so the harness has to hold
// the real seam rather than a stub of it. Loading it here also means a change to the pinned clock
// or the admin code is felt by these assertions instead of silently ignored.
require('./seed.js'); require('./core.js');
const core = globalThis.core;
const file = process.argv[2] || 'console.html';
const html = fs.readFileSync(file, 'utf8');
const js  = html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
// Prose names things. The build-state header describes .rowsel and every a0.17 RPC in English,
// and a check that reads "X must have a rule" or "X must be whitelisted" will happily read the
// sentence saying so as a use of X. Strip comments before counting anything. This defect has
// bitten the schedule checker four times; it is cheaper to inherit the fix than to rediscover it.
const jsBare  = js.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const cssBare = css.replace(/\/\*[\s\S]*?\*\//g, '');

let fails = 0;
const ok  = m => console.log('  PASS  ' + m);
const bad = m => { fails++; console.log('  FAIL  ' + m); };

// Brace-counting extractor. The one-line helpers (tick, emptyRow, jsq) close on their own line,
// so the schedule tool harness's /\n\}/ anchor would swallow the rest of the file for them.
//
// IT NOW READS COMMENTS AS COMMENTS. It used to track quote state and nothing else, so an
// apostrophe anywhere inside a function it was extracting opened a string that never closed, every
// brace after it was ignored, and the extraction ran to the end of the file. The workaround was to
// keep apostrophes out of the page's comments, which is a source file constrained by a
// limitation of its own test harness: the wrong way round, and it stood as a standing open item.
//
// FIVE MODES, one scanner. Line comment, block comment, string, template, REGEX LITERAL. The
// escape is handled by skipping the next character outright rather than by tracking the previous
// one, which is what the old `prev` dance was approximating and getting subtly wrong for a
// trailing double backslash.
//
// THE FIFTH MODE IS NEW, and the gap it closes was a stated one:
//
//   "KNOWN AND ACCEPTED GAP: a regex literal is not a mode. /'/ would still open a phantom
//    string. No function in console.html contains one, the whole suite passing is the evidence."
//
// The evidence was wrong, and it was wrong when it was written. esc() has always contained
// .replace(/"/g,'&quot;'), and that bare double quote inside a regex literal HAS always opened a
// phantom string here. The suite passed anyway by accident: 313 further double quotes followed
// esc() in the original file, one of them closed the phantom string with the brace depth back at
// the right value, and the extraction landed correctly for reasons nothing intended. Porting
// deleted the seminar panel, which took 310 of those quotes with it, and esc() stopped extracting
// at all -- three quotes left, none of them in the right place. A latent defect that a removal
// turned into a crash, which is the failure mode the gap note believed it was avoiding.
//
// DIVISION VERSUS REGEX, which is the reason the note gave for not doing this. Resolved by the
// standard rule rather than by guessing: a / opens a regex only where a value cannot already have
// ended, so it divides after an identifier, a number, a closing paren or a closing bracket, and
// opens a regex everywhere else. A character class gets its own sub-mode so that an unbalanced
// brace or bracket inside one cannot reach the depth counter.
function grab(name){
  const start = js.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('not found: ' + name);
  let i = js.indexOf('{', start), depth = 0, mode = null;
  // The last significant character seen at this level, for the division-versus-regex rule.
  let prevTok = '';
  for (; i < js.length; i++){
    const c = js[i], n = js[i + 1];
    if (mode === '//'){ if (c === '\n') mode = null; continue; }
    if (mode === '/*'){ if (c === '*' && n === '/'){ mode = null; i++; } continue; }
    if (mode === '[]'){                           // a character class inside a regex
      if (c === '\\'){ i++; continue; }
      if (c === ']') mode = '/';
      continue;
    }
    if (mode === '/'){                            // inside a regex literal
      if (c === '\\'){ i++; continue; }
      if (c === '['){ mode = '[]'; continue; }
      if (c === '/'){ mode = null; prevTok = 'x'; }   // a regex is a value, so the next / divides
      continue;
    }
    if (mode){                                    // inside a string or a template
      if (c === '\\'){ i++; continue; }           // skip whatever it escapes, quote or backslash
      if (c === mode){ mode = null; prevTok = 'x'; }
      continue;
    }
    if (c === '/' && n === '/'){ mode = '//'; i++; continue; }
    if (c === '/' && n === '*'){ mode = '/*'; i++; continue; }
    if (c === '/' && !/[\w$)\]]/.test(prevTok)){ mode = '/'; continue; }
    if (c === '"' || c === "'" || c === '`'){ mode = c; continue; }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (!depth) return js.slice(start, i + 1); }
    if (!/\s/.test(c)) prevTok = c;
  }
  throw new Error('unbalanced: ' + name);
}

// ---------------------------------------------------------------- harness
const captured = {};
const document = { getElementById: id => ({
  set innerHTML(v){ captured[id] = v; },
  get innerHTML(){ return captured[id] || ''; },
  value: '', style: {}, classList: { toggle(){} }
}), querySelector: () => null };

// a0.27b. Clock-anchored fixture dates, replacing typed ones. FX_D(n) is n days from today.
//
// Anchored to TODAY, not to a weekday boundary. The first attempt at this fix used the Monday of
// the current week, which is correct Monday to Saturday and wrong on a Sunday: getDay() is 0, the
// arithmetic reaches back six days, and the period lands on the week that has just ended. Found by
// running it on a Sunday. A real duty period is Monday to Friday, but nothing the Away column
// asserts depends on which weekday it starts, only that it is five days long and contains today.
const FX_D = n => { const d = new Date();
  d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); };

const APP = {
  me: { code:'HZO', full_name:'Helena Ostrow' },
  // a0.27. roster_until on every row, one per state, because a fixture with the column absent
  // exercises nothing: onTeam would return true everywhere, every new filter would be a no-op and
  // the whole build would ship green. That is the a0.26 lesson (the Away column passing with
  // APP.absences undefined) applied before it can bite a second time.
  //   PYR  on team, clean                      -> no pill, no flag
  //   HZO  on team, and it is ME               -> no leaving-date control at all
  //   TQL  leaving in the future, login ALREADY gone -> "leaving" pill, still in every selector,
  //        and NO flag. This is CJR's real shape between 27/07 and 11/08: access cut early on a
  //        bad exit, date recorded, nothing outstanding. The first cut of the warning fired here
  //        for a fortnight, which is the case this fixture exists to hold shut.
  //   MJD  on team, NO date, no live login     -> "no login" flag, the state CJR sat in on 27/07
  //   SBW  posture 2, on team                  -> inactive, and NOT hidden by the new filter
  //   NFH  no auth row at all                  -> unknown posture, no flag
  //   CJR  active TRUE with a past date         -> "left" pill, "login live" flag, out of every
  //        selector. This is the shape the new model actually produces, and the shape a filter
  //        written on p.active alone would miss entirely.
  people: [
    { code:'PYR', full_name:'Priya Raman', active:true,  mentor:null,  roster_until:null },
    { code:'HZO', full_name:'Helena Ostrow',       active:true,  mentor:null,  roster_until:null },
    { code:'TQL', full_name:'Tomas Lindqvist',       active:true,  mentor:null,  roster_until:'2099-01-01' },
    { code:'MJD', full_name:'Marcus Devlin',      active:true,  mentor:null,  roster_until:null },
    { code:'SBW', full_name:'Sarah Whitlock',          active:false, mentor:'MJD', roster_until:null },
    { code:'NFH', full_name:'Nadia Fahim', active:true,  mentor:'HZO', roster_until:null },
    { code:'CJR', full_name:'Callum Reyes',   active:true,  mentor:'TQL', roster_until:'2020-01-31' }
  ],
  authByCode: { HZO:{has_login:true,banned:false}, PYR:{has_login:true,banned:false},
                TQL:{has_login:false,banned:false}, SBW:{has_login:true,banned:false},
                MJD:{has_login:false,banned:false}, CJR:{has_login:true,banned:false} },
  lots: [{ reserved_by:'PYR', frozen:false, is_use_test:false }],
  lrs:  [{ created_by:'PYR', report_date:null }],
  taskStatuses: [{ value:'Planned', texture:'solid', is_terminal:false, cancelled:false,
                   needs_start:false, active:true, sort_order:10 }],
  absenceTypes: [{ value:'Annual Leave', code:'AL', active:true }],
  instruments:  [{ code:'LC2', name:'HPLC-2', active:true,  sort_order:10,
                   owner_main:'TQL', owner_backup:null },
                 { code:'GC4L1', name:'GC-4 Line 1', active:false, sort_order:20,
                   owner_main:null, owner_backup:null }],
  publicHolidays: [{ holiday_date:'2026-08-09', name:'National Day' }],
  standingRoles: [{ code:'RM', name:'RM', main:'PYR', backup:null, active:true, sort_order:10 },
                  { code:'BEV', name:'Beverage', main:null, backup:null, active:false, sort_order:50 }],
  tdListErr: {},
  // a0.18. renderDuties joins the harness rather than being noted as a coverage gap for a third
  // time: two mutations in the new panel (a dropped cell, a wrong empty-row colspan) sailed
  // through a suite whose whole subject is dropped cells and wrong colspans, because it drove
  // renderRoster and renderTdSetup and nothing else. A checker that does not render a panel is
  // not checking that panel, however many assertions it has.
  dutyTypes: [{ code:'HK',  name:'Housekeeping', colour:'#6a8fd8', show_final_days:null, active:true,  sort_order:10 },
              { code:'KYT', name:'KYT',          colour:null,      show_final_days:14,   active:false, sort_order:20 }],
  // a0.27b. THESE DATES ARE COMPUTED, AND THEY USED TO BE TYPED. The fixture was written on
  // 26/07/26 with the live period hardcoded as 27/07/26 to 31/07/26, which worked for exactly six
  // days: renderDuties hides finished periods, so on 02/08/26 all three rows fell into "(3 hidden)"
  // and four assertions that check PAINTED markup found nothing to look at. Four red lines, a green
  // build, no defect anywhere. A fixture with a date typed into it has an expiry date, and it
  // expires into something that reads exactly like a regression.
  duties: [{ id:1, duty_type:'HK', person:'TQL', start_date:FX_D(-2), end_date:FX_D(2) },
           { id:2, duty_type:'HK', person:'NFH', start_date:FX_D(-2), end_date:FX_D(2) },
           { id:3, duty_type:'HK', person:'MJD', start_date:'2020-01-06', end_date:'2020-01-10' }],
  // a0.26. Absences, so the Away column is actually EXERCISED. Without these the fixture leaves
  // APP.absences undefined, awayDays returns 0 for every row, the cell renders empty, the header
  // count still matches an empty cell, and the whole marker ships uncovered behind a green suite.
  // TQL partial, NFH the whole period, MJD nothing: one of each state the column can be in.
  absences: [{ person_code:'TQL', start_date:FX_D(-1), end_date:FX_D(0),  label:'away' },
             { person_code:'NFH', start_date:FX_D(-9), end_date:FX_D(12), label:'away' }],
  absErr: null,
  dutyErr: null, dutyPast: false, dutyImport: null, dutyImportType: null
};

eval(grab('esc')); eval(grab('jsq')); eval(grab('tick')); eval(grab('emptyRow'));
eval(grab('fmtDateOnly')); eval(grab('sgtToday')); eval(grab('personLabel'));
eval(grab('dutyTypeOptions')); eval(grab('dutyPersonOptions'));
eval(grab('errBox')); eval(grab('panel')); eval(grab('ordCell')); eval(grab('texSel'));
// a0.27. onTeam first: posture, rosterUntilPill, inconsistency and all four selectors now call it,
// and a name missing from this list surfaces as "onTeam is not defined" from inside renderRoster
// rather than as anything about the roster. The three extra selectors join the harness because the
// build changes all four and a suite that only drives one is asserting a quarter of the change.
// a0.31: notLeaving joins onTeam and must be evaled BEFORE rosterOptions, which now calls it.
// Functions are pulled out of the HTML by name here, so a new dependency inside an evaled function
// is a ReferenceError rather than a failing assertion, and it is the harness that has to move.
eval(grab('onTeam')); eval(grab('notLeaving'));
eval(grab('rosterUntilPill')); eval(grab('inconsistency'));
eval(grab('rosterOptions')); eval(grab('posture')); eval(grab('ownedSplit'));
eval(grab('ownerOptionsAdmin'));   // pwOwnerOptions went with the seminar panel
// a0.28. reassignControls is gone with the old Offboard tab. obSuccessorOptions replaces it and
// carries the same rule, so the assertion moves rather than retiring: the screen whose entire job
// is moving work OFF a leaver must never offer another leaver as the destination.
eval(grab('obSuccessorOptions')); eval(grab('obKey')); eval(grab('obLive')); eval(grab('obFrozen'));
eval(grab('obVerbOf')); eval(grab('obSucOf')); eval(grab('obPlanArray'));
eval(grab('obChecklist')); eval(grab('obSetGroup'));
eval(grab('groupVerb')); eval(grab('groupSuc'));
// obSetGroup ends by repainting. Stubbed, so the fixture exercises the guard rather than dying on
// a missing renderer: the mutation that removes the guard reached renderOffboard, threw, and my
// runner counted a crash as a survivor because it only reads FAIL lines. A crash is not an
// assertion, and a suite that kills mutations by falling over is not killing them.
function renderOffboard(){}
eval(grab('lotLocked')); eval(grab('lrLocked')); eval(grab('sgtYear2'));
const TEXTURES = eval('(' + js.match(/const TEXTURES = (\[[\s\S]*?\]);/)[1] + ')');
eval(grab('renderRoster')); eval(grab('renderTdSetup')); eval(grab('renderDuties'));

// Rendered TWICE, populated and empty. The empty branch of every panel is a separate row with
// its own colspan, and with populated fixtures it never executes: a colspan of 4 on a 5-column
// table passed this suite until a mutation proved the path was cold. An empty console is also
// the state a new deployment is actually in, so it is not a hypothetical.
// a0.30 splits the roster: current team in the main table, a collapsed Departed section beneath.
// The fixture opens it, because every posture-3 assertion below reads a departed person's row and
// a collapsed section renders nothing. Opening it here also means the row builder is proven to
// serve BOTH tables rather than only the one that happens to be expanded.
APP.showGone = true;
renderRoster(); renderTdSetup(); renderDuties();
const rendered = { 'view-roster': captured['view-roster'], 'view-tdsetup': captured['view-tdsetup'],
                   'view-duties': captured['view-duties'] };
// The import report is a whole branch that only renders after an import, so it is driven here
// rather than left to a screenshot: it is the one part of the panel a user sees exactly when
// something has gone wrong.
APP.dutyImport = [{ line_no:1, ok:true, message:'2 assignment(s)' },
                  { line_no:2, ok:false, message:'unknown person code: ZZZ' },
                  { line_no:0, ok:false, message:'1 line(s) failed. NOTHING was imported.' }];
APP.dutyImportType = 'HK';
renderDuties();
rendered['view-duties (with report)'] = captured['view-duties'];
APP.dutyImport = null; APP.dutyImportType = null;
// And the finished-assignments toggle, which changes which rows the table holds.
APP.dutyPast = true; renderDuties(); rendered['view-duties (past shown)'] = captured['view-duties'];
APP.dutyPast = false;
const FULL_PEOPLE = APP.people;
APP.people = []; APP.taskStatuses = []; APP.absenceTypes = []; APP.instruments = [];
APP.publicHolidays = []; APP.standingRoles = []; APP.lots = []; APP.lrs = [];
APP.dutyTypes = []; APP.duties = [];
// a0.30 splits the roster: current team in the main table, a collapsed Departed section beneath.
// The fixture opens it, because every posture-3 assertion below reads a departed person's row and
// a collapsed section renders nothing. Opening it here also means the row builder is proven to
// serve BOTH tables rather than only the one that happens to be expanded.
APP.showGone = true;
renderRoster(); renderTdSetup(); renderDuties();
rendered['view-duties (empty)'] = captured['view-duties'];
rendered['view-roster (empty)']  = captured['view-roster'];
rendered['view-tdsetup (empty)'] = captured['view-tdsetup'];
APP.people = FULL_PEOPLE;

// ---------------------------------------------------------------- 1. classes
console.log('\nCLASSES');
{
  // Two passes, lifted from the schedule checker. The first takes attributes with no template
  // machinery in them; the second takes the literal head of a concatenated one, up to the
  // quote-plus. Without the second, every class before a ternary is invisible; without the
  // exclusion set in the first, the ternary itself is read as a class name.
  const emitted = new Set();
  for (const m of jsBare.matchAll(/class="([^"'{}+]+)"/g))
    m[1].trim().split(/\s+/).forEach(c => c && emitted.add(c));
  for (const m of jsBare.matchAll(/class="([^"]*?)'\s*\+/g))
    m[1].trim().split(/\s+/).forEach(c => c && emitted.add(c));
  const defined = new Set([...cssBare.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const missing = [...emitted].filter(c => {
    if (defined.has(c)) return false;
    if (c.endsWith('-')) return ![...defined].some(d => d.startsWith(c));  // concatenated prefix
    return true;
  }).sort();
  missing.length ? bad('classes emitted with no CSS rule: ' + missing.join(', '))
                 : ok(emitted.size + ' classes emitted, every one has a rule');
}

// ---------------------------------------------------------------- 2. column counts
// The a0.15 lesson generalised. A rendered table is the only place a miscount shows, and it
// shows as a shifted column rather than an error, which is exactly what a screenshot forgives.
console.log('\nCOLUMN COUNTS');
{
  let tables = 0, rows = 0;
  Object.entries(rendered).forEach(([view, h]) => {
    if (!h) { bad(view + ' rendered nothing'); return; }
    [...h.matchAll(/<table class="data">([\s\S]*?)<\/table>/g)].forEach((tm, ti) => {
      const body = tm[1];
      const head = (body.match(/<thead>([\s\S]*?)<\/thead>/) || ['',''])[1];
      const want = (head.match(/<th[\s>]/g) || []).length;
      if (!want) { bad(view + ' table ' + ti + ' has no headers'); return; }
      tables++;
      const tb = (body.match(/<tbody>([\s\S]*?)<\/tbody>/) || ['',''])[1];
      [...tb.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].forEach((rm, ri) => {
        // An alternation rather than a character class, so the scrub gate reads this literal as
        // the markup it is. That rule needs a space or a closing angle bracket directly after
        // the tag name, and an opening square bracket is neither. Same set of matches for
        // everything these renderers emit: a bare cell, or one carrying an attribute.
        // The comment says that without writing the shape out, which would itself be a hit.
        const cells = (rm[1].match(/<td |<td>/g) || []).length;
        const span  = [...rm[1].matchAll(/colspan="(\d+)"/g)].reduce((a,b)=>a + (+b[1]) - 1, 0);
        rows++;
        if (cells + span !== want)
          bad(view + ' table ' + ti + ' row ' + ri + ': ' + (cells + span) + ' cells against ' + want + ' headers');
      });
    });
  });
  if (!fails) ok(tables + ' rendered tables, ' + rows + ' rows, every row matches its header count');
}

// ---------------------------------------------------------------- 3. toolbar
console.log('\nTOOLBAR CHILD COUNT');
{
  // .toolbar is justify-content:space-between. Two children means "text left, actions right".
  // Three means the middle one floats, which is the a0.15 defect. Counted on the emitted
  // source rather than the render, because two of the four callers are in tabs this harness
  // does not drive.
  const rule = (cssBare.match(/\.toolbar\{([^}]*)\}/) || ['',''])[1];
  if (!/space-between/.test(rule)) bad('.toolbar is no longer space-between; this check assumed it');
  // Counted on RENDERED output, not on the source. The toolbar is assembled from four or five
  // concatenated string literals and a static child count off that is a guess dressed as a test.
  // Coverage limit, stated rather than hidden: this drives renderRoster and renderTdSetup only.
  // renderProducts, renderOffboard and renderPw each have a toolbar this does not reach, and
  // renderPw's is the one that shipped the a0.15 defect. Extending the harness to those three
  // is the obvious next commit and is deliberately not in this build.
  let seen = 0;
  Object.entries(rendered).filter(([v]) => !v.includes('empty')).forEach(([view, h]) => {
    [...(h||'').matchAll(/<div class="toolbar">([\s\S]*?)<\/div>\s*<div class="tablewrap">/g)].forEach((m, i) => {
      let flat = m[1], prev;
      do { prev = flat;
           flat = flat.replace(/<(div|span|button)\b[^>]*>(?:(?!<\1\b)[\s\S])*?<\/\1>/g, (s,t)=>'<'+t+'/>');
      } while (flat !== prev);
      const top = (flat.match(/<(div|span|button|select|input)\b/g) || []).length;
      seen++;
      if (top !== 2) bad(view + ' toolbar ' + i + ' has ' + top + ' children, not 2');
    });
  });
  if (!seen) bad('no rendered toolbar found; the check is not looking at anything');
  else if (!fails) ok(seen + ' rendered toolbar(s), each with exactly two children (roster and setup only)');
}

// ---------------------------------------------------------------- 4. rpc surface
console.log('\nRPC SURFACE');
{
  // Read off prod 24/07/26 in the block 1-3 post-checks, except where noted.
  // set_instrument_bookable read off prod 25/07/26 in the K2 post-check, and
  // rename_instrument_code in the K8 post-check, all three: definer=true, search_path empty, one
  // overload each, EXECUTE granted to authenticated. K7 rebuilt both inbound FKs as ON UPDATE
  // CASCADE first, which is what makes a code rename possible at all.
  // set_duty_assignment_person read off prod 26/07/26 in the K9 post-check, same shape, and
  // set_duty_assignment_note in K10. K10 also DROPPED set_duty_note: topics are per assignment,
  // not per period, so a writer that forced both rows of a pair equal was destroying one of two.
  const VERIFIED = new Set(`team_members roster_auth_status add_person set_person_active remove_person
    add_product retire_product set_product_active set_product_colour set_product_order
    add_task_status set_task_status_texture set_task_status_terminal set_task_status_cancelled
    set_task_status_active set_task_status_needs_start set_task_status_order delete_task_status
    add_absence_type set_absence_type_active set_absence_type_code delete_absence_type
    add_instrument update_instrument set_instrument_active set_instrument_order delete_instrument
    set_public_holiday delete_public_holiday
    update_lot update_lr revise_lr release_lot release_lr
    set_person_mentor set_instrument_owners
    add_standing_role update_standing_role set_standing_role_owners set_standing_role_active
    add_duty_type update_duty_type set_duty_type_active
    create_duty_assignment delete_duty_assignment import_duty_assignments
    delete_duty_assignments
    set_instrument_bookable
    offboard_inventory offboard_validate offboard_apply
    rename_instrument_code set_duty_assignment_person set_duty_assignment_note
    set_person_roster_until`
    .split(/\s+/).filter(Boolean));
  // Identity functions, not writes. Same split the schedule checker makes: the whitelist is about
  // write surface verified against prod, and the spine is the door.
  const SPINE = new Set(['caller_code','caller_is_admin','caller_roster_code','caller_in_roster',
                         'whoami','team_members']);
  // The four a0.17 names are the last two lines. set_person_mentor and set_instrument_owners
  // were read off prod 24/07/26 (blocks 1B and 2B post-checks); the four standing-role names
  // came back from the block 3B post-check the same day, all definer, all granted authenticated.
  // Capture the WHOLE quoted token, not /[a-z_]+/. A name-shaped mutation with one stray
  // character (set_standing_role_activeX) fails a lowercase-only class part-way through, then
  // fails to find the closing quote, and matches nothing at all: the call goes invisible and
  // the check passes while an unverified RPC ships. Caught by mutation, not by reading. This is
  // the same defect as the schedule checker's computed-name hole, which is checker lesson 1.
  // EVERY funnel, and a0.18 proved why this list has to be maintained rather than assumed. The
  // Duties panel introduced dutyWrite, a second wrapper in the tdWrite shape, and five of its six
  // new RPCs were invisible to this check on the first run: only import_duty_assignments, which
  // happens to call sb.rpc directly, was flagged. The check reported one unverified name while
  // five others shipped unchecked, which is worse than reporting none, because it looks like it
  // looked. Same defect as the schedule checker's computed-name hole, one indirection along.
  const is_used = (n, m) => used.has(n) ? ok(m + ': ' + n) : bad('not called anywhere: ' + n);
  const FUNNELS = ['rpc', 'tdWrite', 'dutyWrite'];
  const used = new Set(FUNNELS.flatMap(fn =>
      [...jsBare.matchAll(new RegExp('\\b' + fn + "\\('([^']+)'", 'g'))].map(m => m[1]))
    .concat([...jsBare.matchAll(/'(set_[a-z_]+_order)'/g)].map(m => m[1])));
  // And the variable form, which no name-matching check can see. console.html has exactly two
  // deliberate indirection points and both are funnels, not holes: tdWrite(name, ...) is the
  // single Setup write path, and moveRow(rpcName, ...) carries a reorder through. Every caller
  // of both passes a literal, and those literals ARE captured above. So the assertion is not
  // "no computed calls" but "these two and no others": a third one is a new hole and fails.
  // Asserted rather than suppressed. Widening this set to make a build pass is how a suite
  // hollows out, so the next name added here needs a reason written next to it.
  const ALLOWED_INDIRECTION = new Set(['name', 'rpcName']);
  const computed = [...new Set([...jsBare.matchAll(/\b(?:sb\.rpc|tdWrite|dutyWrite)\(\s*([A-Za-z_$][\w$.]*)\s*[,)]/g)]
    .map(m => m[1]))].filter(v => !ALLOWED_INDIRECTION.has(v));
  computed.length ? bad('RPC called by an unrecognised variable, invisible to this check: ' + computed.join(', '))
                  : ok('the only computed RPC names are the known funnels');
  // The funnel list itself is now the thing that can fall behind, so it is asserted. Any function
  // whose body forwards a name straight to sb.rpc is a funnel and must be named in FUNNELS, or
  // every call site through it goes unchecked exactly as the duty writes did.
  const declared = [...jsBare.matchAll(/async function ([a-zA-Z]+)\(name, args/g)].map(m => m[1]);
  const missing = declared.filter(d => !FUNNELS.includes(d));
  missing.length ? bad('write funnel(s) not in FUNNELS, so their RPC names are unchecked: ' + missing.join(', '))
                 : ok(declared.length + ' write funnels, all of them in FUNNELS');
  // a0.19 put delete_duty_assignment and delete_duty_assignments (singular and plural) on the same
  // list. They differ by one character and do very different things, one row against a whole
  // range, so both are asserted present: a typo that turns one into the other would otherwise
  // pass this check by matching its neighbour.
  ['delete_duty_assignment', 'delete_duty_assignments'].forEach(n =>
    is_used(n, 'both the single-row and the ranged delete are called'));
  const unknown = [...used].filter(u => !VERIFIED.has(u) && !SPINE.has(u)).sort();
  unknown.length ? bad('RPC names not verified against prod: ' + unknown.join(', '))
                 : ok(used.size + ' RPC names, all verified against prod');
  // PORT NOTE, and it is the assertion this gate turns on. The whitelist was 'verified against
  // prod', and there is no prod here: the seam is core.js, so the list is now checked against it.
  // A name can be on the list, be called by this page, and still not exist behind the seam, which
  // is exactly what the four seminar RPCs were. They came off the list because the panel went;
  // this assertion is what would have caught them had they not.
  const behind = [...used].filter(n => !SPINE.has(n));
  const unimplemented = behind.filter(n => typeof core.RPCS[n] !== 'function').sort();
  unimplemented.length
    ? bad('called by this page but not implemented in core.js: ' + unimplemented.join(', '))
    : ok(behind.length + ' write RPCs, every one of them implemented in core.js');
  // The spine is the door and is asserted separately, because a missing caller_is_admin does not
  // fail a write, it fails the routing, and the symptom is a blank page rather than a toast.
  const spineGone = [...SPINE].filter(n => typeof core.RPCS[n] !== 'function').sort();
  spineGone.length
    ? bad('identity RPC missing from core.js: ' + spineGone.join(', '))
    : ok('and all ' + SPINE.size + ' identity RPCs are there too');
  // The reverse direction is NOT asserted. core.js serves three pages and holds RPCs this one
  // never calls; an unused name behind the seam is not a defect here.
}

// ---------------------------------------------------------------- 5. migration controls
// a0.19 exists to make a weekend data migration survivable, and two of its three controls were
// wired in ways nothing above could see. Mutating p_dry_run to a hardcoded false passed every
// check: the Check button would have written a year of assignments while reporting a preview,
// which is the single worst failure this panel could have. Deleting the bulk-delete button also
// passed. Rendered assertions where the harness can reach, source where it cannot.
console.log('\nABSENCE MARKER');
{
  const dv = rendered['view-duties'] || '';
  // Painted, not merely derived. The three lessons this file already carries say a green suite is
  // not evidence a feature reached the screen, so assert the markup.
  /class="da-away"[^>]*>2 of 5 d</.test(dv)
    ? ok('a partial overlap paints the day count: TQL is away 2 of the 5')
    : bad('the partial overlap marker did not render');
  /da-away da-away-all"[^>]*>all 5 d</.test(dv)
    ? ok('a full-period absence paints as all 5 d and takes the stronger class')
    : bad('the full-coverage marker did not render');
  (dv.match(/class="da-away/g) || []).length === 2
    ? ok('and exactly two of the three rows carry one: MJD has no absence and stays blank')
    : bad('the marker count does not match the fixture: it is firing on rows with no absence');
  // The column exists on every type, not only the ones with topics: housekeeping is where the
  // weekly clashes actually are.
  (dv.match(/<th class="mid" style="width:90px;"/g) || []).length >= 1
    ? ok('the Away header is emitted')
    : bad('the Away column has cells but no header');
  // PORT NOTE. The projection and the category filter moved into the core.js registry, so the
  // assertion follows them there rather than being deleted. The page names a read; the registry
  // says what that read is. Both halves are still asserted, one per side of the seam, and the
  // v_grid-not-absences rule is now unforgeable from the page at all: a page that wanted the
  // absences table directly would have to add a registry entry to get one.
  /core\.read\(\s*'gridAbsences'/.test(jsBare)
    ? ok('the duty loader asks for the named gridAbsences read')
    : bad('the absence read is not going through the gridAbsences registry entry');
  const GA = core.READS.gridAbsences;
  GA && GA.from === 'v_grid' && GA.eq && GA.eq[0] === 'category' && GA.eq[1] === 'absence'
    ? ok('and that entry is v_grid filtered to the absence category')
    : bad('gridAbsences is not v_grid filtered on the absence category');
  Object.keys(core.READS).some(k => core.READS[k].from === 'absences')
    ? bad('a registry entry reads the absences table directly: its RLS path is unproven here')
    : ok('and no registry entry reads the absences table, whose policy this console has never exercised');
}

// ---------------------------------------------------------------- 6. the leaver lever (a0.27)
// Split in two on purpose. The PREDICATE is pure and gets fixtures; everything else asserts what
// reached the screen, because "onTeam returns false" is not evidence that anybody was hidden.
console.log('\nLEAVER LEVER: PREDICATE');
{
  const today = sgtToday();
  const past = '2020-01-31', future = '2099-01-01';
  onTeam({ roster_until:null }) ? ok('no date means on the team')
                                : bad('a null date is being read as departed');
  // INCLUSIVE. Their last day is a day they are still here, and this is the assertion that pins
  // it: an off-by-one here empties somebody's dashboard on the morning of their leaving do.
  onTeam({ roster_until:today }) ? ok('the leaving date itself is still on the team (inclusive)')
                                 : bad('off by one: they vanish on their own last day');
  onTeam({ roster_until:future }) ? ok('a future date is still on the team')
                                  : bad('a future leaving date is hiding somebody who is still here');
  !onTeam({ roster_until:past }) ? ok('a past date is off the team')
                                 : bad('a past leaving date is not hiding anybody');
  // A timestamp arriving where a date was expected must not compare longer than the boundary.
  !onTeam({ roster_until:past + 'T00:00:00+08:00' })
    ? ok('and a timestamp is sliced to its date before comparing')
    : bad('an unsliced timestamp compares longer than the boundary and reads as on-team');
  // The two levers are independent, which is the entire model. Asserted rather than assumed,
  // because the cheapest wrong build here is one that quietly ANDs them back together.
  onTeam({ active:false, roster_until:null })
    ? ok('inactive with no date is still on the team: posture 2 is not offboarding')
    : bad('the predicate is reading active, which collapses the two levers into one');
}

console.log('\nLEAVER LEVER: SELECTORS');
{
  // All four, with the same two questions each: is the leaver gone, and does the already-selected
  // escape still hold. The escape matters more than the exclusion - without it, opening any row a
  // departed person owns would offer to blank it.
  const has = (h, code) => new RegExp('value="' + code + '"').test(h);
  // DEPARTED goes from all three. That part has not moved.
  // Two surfaces, not three: pwOwnerOptions was the third and went with the seminar panel.
  // The rule it carried is unchanged and still asserted on ownerOptionsAdmin below.
  [['rosterOptions', rosterOptions('')],
   ['ownerOptionsAdmin', ownerOptionsAdmin('')]].forEach(([name, h]) => {
    !has(h, 'CJR') ? ok(name + ' drops the departed person')
                   : bad(name + ' still offers CJR, who left on 31/01/20');
  });
  // a0.31 SPLITS THE SECOND QUESTION, because the three surfaces stopped agreeing on it. TQL has a
  // future roster end, so she is on the team and she is leaving, and whether she belongs in a list
  // now depends on what the list is FOR. That distinction did not exist before this build and the
  // loop above was quietly asserting it away.
  //
  // OUT of rosterOptions, which feeds mentor, instrument owner, standing role and duty person.
  // Every one is an ongoing responsibility somebody would have to hand back.
  !has(rosterOptions(''), 'TQL')
    ? ok('rosterOptions drops somebody with a roster end: these are responsibilities, not records')
    : bad('rosterOptions still offers TQL as a mentor, instrument owner or duty holder, and she is leaving');
  // IN for ownerOptionsAdmin, which records who DID something. An LR keeps its author, and that
  // is not a thing a leaving date should touch. The seminar surface held the same rule for its
  // presenter; it is gone, and the rule survives here.
  has(ownerOptionsAdmin(''), 'TQL')
    ? ok('ownerOptionsAdmin keeps her: an LR author is a record of the past, not an assignment')
    : bad('ownerOptionsAdmin is hiding TQL, and an author is not a duty to hand over');
  has(rosterOptions('CJR'), 'CJR')
    ? ok('rosterOptions keeps a departed person when they are the current value')
    : bad('a departed instrument owner would be silently blanked on the next save');
  has(ownerOptionsAdmin('CJR'), 'CJR')
    ? ok('ownerOptionsAdmin keeps them too: a signed LR keeps its author')
    : bad('loading a departed author\'s LR would offer to reassign it to nobody');
  // The successor dropdown has no escape and should not: these are destinations, not a value.
  APP.offboardCode = 'PYR';
  const rc = obSuccessorOptions('', 'Reassign to...');
  !has(rc, 'CJR') ? ok('the Offboard successor dropdown drops the departed person')
                  : bad('the tab that moves work OFF a leaver is offering another leaver as the target');
  // a0.31, and this one was found by the checker rather than by the scope: a successor is a
  // DESTINATION, so handing work to somebody who is also leaving means handing it over twice.
  !has(rc, 'TQL')
    ? ok('nor somebody who is leaving themselves: a successor with a roster end is a second handover')
    : bad('the tab that moves work off a leaver is offering another leaver as the target');
  has(rc, 'MJD') ? ok('while everybody actually staying is still offered')
                 : bad('the successor dropdown has lost somebody who is here to stay');
  !has(rc, 'PYR') ? ok('and never the person being offboarded, which would be a no-op handover')
                  : bad('the person being offboarded is offered as their own successor');
  !has(rc, 'HZO') ? ok('nor the admin: HZO is not a bench destination')
                  : bad('HZO is offered as a successor');
  APP.offboardCode = null;

  // a0.28. THE PLAN, which is the only new logic on this tab that can be wrong silently. Every
  // other part of it is a screen you would notice. obPlanArray decides what actually gets sent.
  APP.offboardCode = 'PYR';
  APP.obInv = [
    { cls:'B', surface:'lots.reserved_by',        target_id:'1',  label:'X-26-01', detail:'open lot',
      verbs:'reassign,release,keep', dflt:'reassign' },
    { cls:'B', surface:'lots.reserved_by',        target_id:'2',  label:'X-26-02', detail:'open lot',
      verbs:'reassign,release,keep', dflt:'reassign' },
    { cls:'D', surface:'absences.person_code',    target_id:'9',  label:'AL', detail:'',
      verbs:'delete,truncate,keep', dflt:'truncate' },
    { cls:'A', surface:'lots.reserved_by',        target_id:null, label:'frozen lots', detail:'3',
      verbs:'keep', dflt:'keep' }
  ];
  APP.obPlan = {}; APP.obSuc = '';

  // Class A never enters a plan. It has no target_id and nothing to decide, and including it would
  // ask the server to reassign a count.
  obLive().length === 3 ? ok('the plan covers every live line and no frozen one')
                        : bad('obLive is including class A rows, which have no target to act on');
  obFrozen().length === 1 ? ok('and the frozen summary is kept separately for the checklist baseline')
                          : bad('obFrozen has lost the class A rows');

  // Sparse by design: an untouched line uses the inventory default rather than storing a copy.
  // A stored copy would go stale the moment the inventory is refetched, which happens on every write.
  let pl = obPlanArray();
  pl.length === 3 ? ok('every live line is sent, so the server-side missing-line check has nothing to find')
                  : bad('obPlanArray is dropping lines, which offboard_validate would reject wholesale');
  // Two of the three are reassign; the absence defaults to truncate and carries no successor at
  // all. The first cut of this line expected three and failed, which was the fixture being wrong
  // rather than the code, and worth leaving recorded.
  pl.filter(x => x.verb === 'reassign' && !x.successor).length === 2
    ? ok('with no successor picked, both reassign lines go out incomplete and validate refuses them')
    : bad('a successor is being invented where none was chosen');

  // THE GLOBAL SUCCESSOR IS A DEFAULT, NOT AN OVERRIDE. It fills every reassign line that has no
  // per-line choice, and a per-line choice beats it. Getting this backwards would silently send
  // everything to one person on the exact workflow that exists to disperse it.
  APP.obSuc = 'TQL';
  pl = obPlanArray();
  pl.filter(x => x.successor === 'TQL').length === 2
    ? ok('the global successor fills both reassign lines')
    : bad('the global successor is not reaching the lines it should');
  // State set directly rather than through obSet, which ends by calling renderOffboard and would
  // drag the whole DOM in. What is worth asserting is what obPlanArray BUILDS from the state, not
  // the two-line setter that writes it.
  APP.obPlan['lots.reserved_by|2'] = { suc:'MJD' };
  pl = obPlanArray();
  (pl.find(x => x.target_id === '1').successor === 'TQL' &&
   pl.find(x => x.target_id === '2').successor === 'MJD')
    ? ok('and a per-line successor beats it, which is the dispersing case')
    : bad('the global successor is overriding a per-line choice: dispersing work would be impossible');

  // A successor is only ever sent WITH reassign. Sending one alongside release or delete would be
  // recording an intent the verb does not carry.
  APP.obPlan['lots.reserved_by|1'] = { verb:'release' };
  pl = obPlanArray();
  pl.find(x => x.target_id === '1').successor === null
    ? ok('switching to release drops the successor rather than sending a stale one')
    : bad('a released line is carrying a successor, which the log would then record as a handover');
  pl.find(x => x.surface === 'absences.person_code').verb === 'truncate'
    ? ok('an untouched line still uses its inventory default')
    : bad('an untouched line has lost its default verb');

  // THE CHECKLIST IS DERIVED, and the reason is that offboarding runs over days: a stored progress
  // flag can disagree with reality, and a derived one cannot. These assert the two lines that could
  // report clean when they are not.
  APP.obPlan = {}; APP.obSuc = 'TQL';
  // Saved and restored. The posture assertions below read the real authByCode, and the first cut
  // of this block clobbered it and took three of them down with it. A fixture that leaves global
  // state behind is a fixture that fails somebody else's test.
  const savedAuth = APP.authByCode;
  APP.authByCode = { PYR: { has_login:true } };
  APP.obBaseline = { 'lots.reserved_by': '3' };
  let cl = obChecklist();
  /login still live/.test(cl)
    ? ok('line 5 reads the live auth status, so a kept login cannot pass as deleted')
    : bad('the checklist would call somebody clean with their login still working');
  // THE TICK, not the sentence beside it. The first cut matched on the detail text, which the
  // mutation that makes line 4 report the PLAN instead of the database does not touch: it flipped
  // the mark from a cross to a tick and survived the whole suite. Read the mark.
  const row4 = (cl.match(/<tr>(?:(?!<\/tr>)[\s\S])*4\. handover executed[\s\S]*?<\/tr>/) || [''])[0];
  /&#10007;/.test(row4)
    ? ok('line 4 stays crossed while anything is still held, however complete the plan is')
    : bad('line 4 is reporting the plan instead of the database: a full plan would read as done');
  /3 still held/.test(row4)
    ? ok('and it says how many, so the number comes from the inventory not the form')
    : bad('line 4 has lost the count');

  // Line 6 compares the FROZEN counts against the baseline taken at first load. A frozen record
  // moving during a handover is the one thing on this screen that should stop everything, and
  // without this it would be invisible.
  APP.obBaseline = { 'lots.reserved_by': '5' };
  /FROZEN COUNTS MOVED/.test(obChecklist())
    ? ok('line 6 catches a frozen record count changing mid-handover')
    : bad('a GMP record moving during offboarding would go unreported');

  // AND IT SAYS WHY IT IS CROSSED. It first read "frozen record counts unchanged" beside a cross,
  // which was true and read as though the frozen check were the thing failing, when lines 4 and 5
  // were. A checklist that is right and reads wrong is still one nobody trusts. The mutation that
  // reverts this survived a fixture testing only the FROZEN branch.
  APP.obBaseline = { 'lots.reserved_by': '3' };
  const row6 = () => (obChecklist().match(/<tr>(?:(?!<\/tr>)[\s\S])*6\. clean[\s\S]*?<\/tr>/) || [''])[0];
  /3 line\(s\) still held/.test(row6())
    ? ok('line 6 names the live count as the reason while anything is held')
    : bad('line 6 reports the frozen check when what failed was the handover');
  APP.obInv = APP.obInv.filter(r => r.cls === 'A');
  /the login is still live/.test(row6())
    ? ok('and names the login once nothing is held but the account survives')
    : bad('line 6 does not say the login is what is left');
  // THE MARK, not the sentence. With everything handed over but the account still live, line 6 must
  // stay crossed. The detail branch is computed separately, so a mutation dropping the login from
  // the tick condition changes nothing the text assertions above can see. Second time this exact
  // shape has bitten in this file.
  /&#10007;/.test(row6())
    ? ok('and stays crossed: a live login is not clean, whatever else is done')
    : bad('line 6 would call somebody clean with their account still working');

  // a0.30. THE ROSTER SPLITS, AND THE DEPARTED ARE NOT HIDDEN. Remove can never work on anybody who
  // has closed a lot, so leavers accumulate on this screen permanently. They move to a collapsed
  // section rather than off the screen, because Clear lives on their row and is the ONLY route from
  // posture 3 back to 2, Remove lives there for the mis-add case, and the "login live" flag exists
  // to say a roster date passed with the account still live, which cannot be read off a row that is
  // not rendered.
  const rr = (js.match(/function renderRoster\([\s\S]*?\n\}/) || [''])[0];
  /APP\.people\.filter\(onTeam\)\.forEach/.test(rr)
    ? ok('the main table carries the current team only')
    : bad('the main roster table is not filtered, so leavers still pile up in it');
  /const gone = APP\.people\.filter\(p => !onTeam\(p\)\)/.test(rr)
    ? ok('and the departed are collected rather than dropped')
    : bad('departed people are not rendered anywhere, which strands Clear and hides login live');
  /gone\.forEach\(p => \{ h \+= rosterRow\(p\); \}\)/.test(rr)
    ? ok('and get the SAME row, so every action on it stays reachable')
    : bad('the departed section renders a reduced row, so a transition out of posture 3 is lost');
  /Departed \(' \+ gone\.length/.test(rr)
    ? ok('with a count on the toggle, so an empty roster is not mistaken for a clean one')
    : bad('the departed section does not say how many');
  {
    // Both tables must be reachable from ONE builder. Two copies is how they drift.
    const saved = APP.showGone;
    APP.showGone = false; renderRoster();
    const closed = captured['view-roster'] || '';
    APP.showGone = true; renderRoster();
    const open_ = captured['view-roster'] || '';
    /off roster/.test(closed) === false
      ? ok('collapsed, the departed rows are genuinely absent from the markup')
      : bad('the collapse is cosmetic and the rows are still rendered');
    /off roster/.test(open_)
      ? ok('and expanding brings them back with their pills intact')
      : bad('expanding the departed section renders nothing');
    APP.showGone = saved; renderRoster();
  }

  // THE NOTE EXPLAINS IN POSTURES, because "hide" was doing two different jobs and made the two
  // buttons read as the same thing. Remove deletes the people row; a roster end date hides nobody
  // from THIS screen, it drops them from the tools. The postures say that without the word.
  const rnote = (js.match(/function renderRoster\([\s\S]*?\n\}/) || [''])[0];
  /Posture 1/.test(rnote) && /Posture 2/.test(rnote) && /Posture 3/.test(rnote)
    ? ok('the roster note names all three postures')
    : bad('the roster note explains the two buttons without the model that distinguishes them');
  /Deactivate moves 1 to 2/.test(rnote) && /roster end date moves 1 or 2 to 3/.test(rnote)
    ? ok('and says which button moves between which, which is the whole distinction')
    : bad('the note does not map the buttons onto the postures');
  /None of this is Remove/.test(rnote)
    ? ok('and separates Remove explicitly, which is the confusion the word hide created')
    : bad('Remove is still liable to read as the same thing as a roster end date');
  /They stay on this screen/.test(rnote)
    ? ok('and says a retired person is still visible here, so retire does not read as delete')
    : bad('a roster end date still reads as removing somebody from the roster');

  // a0.29. THE ROSTER NOTE SAYS WHAT EACH BUTTON DOES. It opened with a concept and never stated
  // plainly what any control on the row did, so the one thing somebody arrives at that screen
  // wanting to know was six paragraphs down. Every clickable thing on the row is named.
  const rn = (js.match(/function renderRoster\([\s\S]*?\n\}/) || [''])[0];
  ['\\+ Add person','Mentor','Set roster end','Clear','Deactivate','Reactivate','Offboard','Remove']
    .forEach(c => {
      // ANCHORED ON THE CLOSING TAG. Without it the pattern is a prefix match and renaming Remove
      // to RemoveX still satisfied it, so the mutation that drops a control from the guide survived.
      new RegExp('<td class="code">' + c + '(</td>| |<)').test(rn)
        ? ok('the roster guide names ' + c.replace('\\',''))
        : bad('the roster guide does not say what ' + c.replace('\\','') + ' does');
    });
  // The Offboard link carried split.openCount, open lots and LRs only, beside a tab counting all
  // seventeen surfaces: "Offboard (4)" next to a screen reporting 52. A number that contradicts the
  // screen it links to is worse than no number.
  // Two facts, not one regex across a concatenation: [^)]* stopped at the ) inside esc(p.code).
  />Offboard<\/button>/.test(rn) && !/Offboard \('\+split\.openCount/.test(rn)
    ? ok('and the Offboard link carries no count, so it cannot contradict the tab it opens')
    : bad('the Offboard link shows a count from a different set of surfaces than the tab it opens');

  // THE PREVIEW SAYS WHAT APPLY WOULD DO. It read "Dry run, 2 line(s). Nothing has been written",
  // which announces the mechanism and leaves the reader to work out the meaning; on an all-keep plan
  // a correct run then looks like a broken one. It now counts what changes and says so, and names
  // the all-keep case explicitly rather than showing a table of no-ops with no explanation.
  const ob = (js.match(/function renderOffboard\([\s\S]*?\n\}/) || [''])[0];
  /This is what Apply would do/.test(ob)
    ? ok('the preview says what Apply would do rather than announcing that it is a dry run')
    : bad('the preview describes its own mechanism instead of its result');
  /Apply would change nothing at all/.test(ob)
    ? ok('and names the all-keep case, where a correct run otherwise looks like a broken one')
    : bad('an all-keep plan previews as a table of no-ops with nothing explaining why');
  /rows\.filter\(x => x\.verb !== 'keep'\)\.length/.test(ob)
    ? ok('counting what actually changes, not how many lines the plan has')
    : bad('the preview counts lines rather than changes');
  /Preview changes<\/button>/.test(ob)
    ? ok('and the button is named for its result too')
    : bad('the button is still called Dry run');

  // a0.28b. LINE 3 COUNTED WHAT WAS PRESENT, NOT WHAT WAS MISSING. It read "17 of 52 lines have a
  // verb" beside a cross, and all 52 had one: 17 was the count of lines whose default is not
  // reassign. The cross was right and the sentence was wrong, which is worse than either being
  // wrong alone, and it only misread once reassign was in play. Both branches driven.
  APP.offboardCode = 'PYR';
  APP.obInv = [
    { cls:'B', surface:'a', target_id:'1', label:'x', detail:'', verbs:'reassign,release,keep', dflt:'reassign' },
    { cls:'B', surface:'a', target_id:'2', label:'y', detail:'', verbs:'reassign,release,keep', dflt:'reassign' },
    { cls:'D', surface:'b', target_id:'3', label:'z', detail:'', verbs:'delete,keep', dflt:'delete' }
  ];
  APP.obPlan = {}; APP.obSuc = ''; APP.obBaseline = {};
  const savedAuth2 = APP.authByCode;
  APP.authByCode = { PYR: { has_login:true } };
  const row3 = () => (obChecklist().match(/<tr>(?:(?!<\/tr>)[\s\S])*3\. handover decided[\s\S]*?<\/tr>/) || [''])[0];
  /2 of 3 line\(s\) are set to reassign with no successor/.test(row3())
    ? ok('line 3 names the lines that are actually incomplete, not the ones that are fine')
    : bad('line 3 is counting what is present instead of what is missing');
  /&#10007;/.test(row3())
    ? ok('and stays crossed while any reassign has no successor')
    : bad('line 3 would pass a plan the server is going to refuse');
  APP.obSuc = 'TQL';
  /every line has a verb/.test(row3()) && /&#10003;/.test(row3())
    ? ok('and clears once a successor covers them')
    : bad('line 3 never clears, so the checklist can never be satisfied');
  APP.authByCode = savedAuth2;

  // THE COLLAPSED SUMMARY CARRIES THE DISPOSITION. Twelve groups reading "15 item(s)" said what was
  // there and nothing about what had been decided, so the summary hid the only thing worth
  // summarising and every group had to be expanded to be read. The source is asserted here because
  // the render needs a DOM; the shape it builds is the part that can be wrong.
  const dispoSrc = (js.match(/const dispo = rows => \{[\s\S]*?\n    \};/) || [''])[0];
  /obVerbOf\(r\)/.test(dispoSrc) && /obSucOf\(r\)/.test(dispoSrc)
    ? ok('the group summary reads the live plan, not the inventory defaults')
    : bad('the collapsed row would show a disposition nobody chose');
  /var\(--error\)/.test(dispoSrc)
    ? ok('and calls out a reassign with no successor in red, which is actionable and blocks apply')
    : bad('the one group state that stops the apply is not marked');
  /rows\.length \+ ' item\(s\)'[\s\S]{0,200}dispo\(rows\)/.test(js)
    ? ok('and it is on the collapsed row, so a group can be read without expanding it')
    : bad('the disposition is not reaching the collapsed summary');

  // a0.28 FIXES, both found by looking at the deployed screen rather than by any assertion here,
  // which is the argument for opening the page.
  // THE GROUP CONTROL SHOWS THE GROUP'S STATE, and this assertion has now been wrong twice in
  // opposite directions. First it showed whatever verb happened to be first in the list, which was
  // a value nobody had chosen. Then a0.28a made it a pure setter that re-rendered on a placeholder,
  // which was honest and unusable: it visibly snapped back after every choice and read as broken.
  // The invariant is neither. Uniform group, show the shared verb. Mixed group, show "mixed".
  const grpSel = (js.match(/obSel\('obg_v_[\s\S]*?130\)/) || [''])[0];
  // NOT whitespace-stripped: the pattern it looks for contains a space INSIDE a string literal,
  // and stripping whitespace ate it, so the assertion failed on correct code.
  /\(v===gv\?' selected':''\)/.test(grpSel)
    ? ok('the group verb select marks the shared verb, so a choice sticks instead of bouncing back')
    : bad('the group verb select discards what was just chosen, which reads as broken');
  /gv === null \? '<option value="" selected>mixed/.test(grpSel)
    ? ok('and shows "mixed" rather than inventing a single value for a group that has none')
    : bad('a mixed group would display one of its verbs as though it applied to all of them');
  // BEHAVIOURAL, not source. null means MIXED and '' means nobody has one, and conflating them is
  // how a group of fifteen shows one verb as though it applied to all fifteen. The source assertion
  // above could not see that: the option markup is unchanged by it.
  const R = (v, suc) => ({ cls:'B', surface:'g', target_id:String(Math.random()), label:'', detail:'',
                           verbs:'reassign,release,keep', dflt:v });
  APP.obPlan = {}; APP.obSuc = '';
  const uni = [R('keep'), R('keep')];
  groupVerb(uni) === 'keep' ? ok('a uniform group reports its shared verb, so the control can show it')
                            : bad('a uniform group does not report its verb and the control cannot hold a choice');
  groupVerb([R('keep'), R('release')]) === null
    ? ok('and a mixed group reports mixed rather than picking one of its verbs')
    : bad('a mixed group would display one verb as though it applied to all of them');
  groupSuc([R('keep'), R('keep')]) === ''
    ? ok('a group with nothing to reassign has no successor question to answer')
    : bad('a group with no reassign lines is reporting a successor state');
  const rs = [R('reassign'), R('reassign')];
  APP.obSuc = 'TQL';
  groupSuc(rs) === 'TQL' ? ok('and a group all reassigning to one person reports that person')
                         : bad('the successor control cannot show a shared successor');
  APP.obPlan[obKey(rs[0])] = { suc:'MJD' };
  groupSuc(rs) === null ? ok('while two different successors report mixed')
                        : bad('two different successors would display as one');
  APP.obPlan = {}; APP.obSuc = '';

  const grpSuc = (js.match(/obSel\('obg_s_[\s\S]*?175\)/) || [''])[0];
  /gs === null \? '' : gs/.test(grpSuc) && /gs === null \? 'mixed'/.test(grpSuc)
    ? ok('the successor control follows the same rule')
    : bad('the group successor bounces back or invents a shared value');
  // And the placeholder must not write. val || null would clear every verb in the group.
  // WITH A LINE-LEVEL CHOICE ALREADY MADE, which is the only case where the guard shows. Without
  // it the placeholder writes null across the group, and null resolves back to the default, so a
  // deliberate per-line decision is silently discarded by touching a dropdown and changing nothing.
  // The first version of this fixture had no per-line choice and the mutation survived it.
  APP.obInv = [{ cls:'B', surface:'s', target_id:'1', label:'x', detail:'', verbs:'reassign,keep', dflt:'keep' },
               { cls:'B', surface:'s', target_id:'2', label:'y', detail:'', verbs:'reassign,keep', dflt:'keep' }];
  APP.obPlan = { 's|1': { verb:'reassign', suc:'TQL' } };
  obSetGroup('s', 'verb', '');
  obVerbOf(APP.obInv[0]) === 'reassign'
    ? ok('and the placeholder leaves a per-line choice alone rather than clearing the group')
    : bad('touching the group dropdown and choosing nothing discards a deliberate per-line decision');

  APP.obInv = null; APP.obPlan = {}; APP.obSuc = ''; APP.obResult = null; APP.offboardCode = null;
  APP.obBaseline = null; APP.authByCode = savedAuth;
  // Posture. The date outranks the login, so a leaver whose account still exists reads out.
  const pw = posture(APP.people.find(p => p.code === 'CJR'));
  pw.sc.label === 'out' && /roster ended/.test(pw.note)
    ? ok('posture reads out on a past date and says why')
    : bad('posture is not date-aware: it reports access the gates no longer grant');
  /Login is still live/.test(pw.note)
    ? ok('and names the outstanding login on the same tooltip')
    : bad('the still-live login is not mentioned where the posture is explained');
}

console.log('\nLEAVER LEVER: PAINTED');
{
  const rv = rendered['view-roster'] || '';
  /class="pill offroster"[^>]*>off roster 31\/01\/20</.test(rv)
    ? ok('a past date paints an "off roster" pill with the date on it')
    : bad('the off-roster pill did not render');
  /class="pill rosterend"[^>]*>on roster to 01\/01\/99</.test(rv)
    ? ok('a future date paints an "on roster to" pill')
    : bad('the roster-end pill did not render');
  // a0.27b. The word "leaving" is banned from this control. It reads as the last day of service,
  // which is a payroll date weeks after the last day in the lab, and this column governs tool
  // access. Labelling it "leaving date" invited the wrong value, and the wrong value here hands a
  // departed chemist the whole notice period in every tool. Asserted rather than remembered.
  !/[Ll]eaving date/.test(js)
    ? ok('nothing in the file calls this a leaving date')
    : bad('"leaving date" is back: it invites the payroll date, not the last day in the lab');
  // In the MODAL specifically, not merely somewhere in the file. The note explains the rule to
  // somebody reading the page; the modal is where the value is actually typed, and that is the
  // one moment the warning has to be in front of you. A first pass asserted the phrase anywhere
  // and survived a mutation that stripped it from the dialog and left it in the prose.
  const ruModal = grab('openRosterUntil');
  /last day of service/.test(ruModal)
    ? ok('and the dialog itself says which date it is NOT, where the value gets typed')
    : bad('the payroll-date trap is not named in the dialog that takes the date');
  /Roster end date/.test(ruModal)
    ? ok('and the dialog is titled for the roster, not for leaving')
    : bad('the dialog title does not name the roster');
  // The pills are ADDITIVE. Merging them would be the console narrating two independent columns
  // as one, so the active pill has to survive next to the date pill.
  /<span class="pill on">active<\/span><span class="pill offroster"/.test(rv)
    ? ok('and the active pill survives beside it: two columns, two pills, neither swallowed')
    : bad('the date pill has replaced the active pill instead of joining it');
  (rv.match(/class="pill warn"/g) || []).length === 2
    ? ok('exactly two rows carry a warning: MJD has no login, CJR has one he should not')
    : bad('the warning count does not match the fixture');
  />no login</.test(rv) ? ok('on team with no live login is flagged')
                        : bad('the state CJR sat in on 27/07 still renders unflagged');
  />login live</.test(rv) ? ok('off team with a live login is flagged at the other end')
                          : bad('a leaver whose account is still open is not flagged');
  // The narrowing. A date set with the login already gone is a bad exit run in the right order,
  // not an oversight, and the flag must stay off it for the whole notice period. Asserted on the
  // predicate AND on the paint, because the fixture row also has to survive every selector.
  !inconsistency(APP.people.find(p => p.code === 'TQL'))
    ? ok('a roster end date with the login already cut raises nothing: access first is a valid order')
    : bad('the no-login flag fires for the whole notice period on an early access cut');
  inconsistency(APP.people.find(p => p.code === 'MJD'))
    ? ok('but no date and no login still raises: that state is nobody\'s decision')
    : bad('the narrowing has silenced the case the flag was built for');
  /2 to fix/.test(rv) ? ok('and the meta line carries the count')
                      : bad('the meta line does not surface the flags');
  /on team/.test(rv) ? ok('the meta line counts who is on the team, not just who is active')
                     : bad('the meta line still reports only the active flag');
  // The self-guard. The RPC refuses it server-side; the button must not be there to be refused.
  const gcnRow = (rv.match(/<tr[^>]*>\s*<td class="code">HZO[\s\S]*?<\/tr>/) || [''])[0];
  !/openRosterUntil\('HZO'\)/.test(gcnRow)
    ? ok('your own row is offered no roster-end control')
    : bad('the console offers to date you off your own roster; the RPC would refuse it');
  const wccRow = (rv.match(/<tr[^>]*>\s*<td class="code">CJR[\s\S]*?<\/tr>/) || [''])[0];
  /doClearRosterUntil\('CJR'\)/.test(wccRow)
    ? ok('and a dated row offers Clear, so the date is reversible from where it is shown')
    : bad('no way to undo a roster end date from the roster');
  // Both write paths go through the one RPC. A second writer is a second place to drift.
  const setters = [...jsBare.matchAll(/rpc\('set_person_roster_until'/g)].length;
  setters === 2 ? ok('set and clear share one RPC, called from exactly two places')
                : bad('set_person_roster_until is called ' + setters + ' times, expected 2');
}

console.log('\nMIGRATION CONTROLS');
{
  const dv = rendered['view-duties'] || '';
  const imp = jsBare.match(/async function importDuties\([\s\S]*?\n\}/)[0];
  // The preview must be able to be a preview.
  /p_dry_run: !!dry/.test(imp)
    ? ok('Check passes its dry flag through to the RPC')
    : bad('p_dry_run is not wired to the caller: the preview button may be writing');
  /function importDuties\(dry\)/.test(imp)
    ? ok('and importDuties takes it as a parameter')
    : bad('importDuties does not take a dry flag');
  /onclick="importDuties\(true\)"/.test(dv)
    ? ok('the Check button asks for a dry run')
    : bad('no Check button asking for a dry run');
  /onclick="importDuties\(\)"/.test(dv)
    ? ok('and Import asks for a real one')
    : bad('no Import button');
  // The undo path. Without it, correcting a bad paste is a hundred row deletes, because the
  // import is idempotent and re-pasting adds rather than replaces.
  /onclick="confirmBulkDelete\(\)"/.test(dv)
    ? ok('the ranged remove is rendered')
    : bad('no ranged remove: undoing a bad paste would be one click per row');
  /id="bd_type"[\s\S]*?id="bd_from"[\s\S]*?id="bd_to"/.test(dv)
    ? ok('with a type and both date bounds')
    : bad('the ranged remove is missing one of its three inputs');
  /onclick="copyDuties\(\)"/.test(dv)
    ? ok('and the TSV copy is rendered, so a year can be checked against its source')
    : bad('no TSV copy');
  // It must round-trip: what comes out has to be what the paste box accepts.
  const cp = jsBare.match(/function copyDuties\([\s\S]*?\n\}/)[0];
  /fmtDateOnly\(p\[1\]\) \+ '\\t' \+ fmtDateOnly\(p\[2\]\)/.test(cp)
    ? ok('copy emits start, end, then names, tab separated: the import format exactly')
    : bad('copy does not emit the format the import reads');
}

// ---------------------------------------------------------------- 10. build currency [REMOVED]
// The whole group is gone, 16 assertions: the a0.31 head-line-vs-BUILD_ID agreement, the
// no-store and byte-Range shape of serverBuildId, the a-prefix-not-v-prefix pattern, the focus
// and visibilitychange wiring, the hidden-until-it-speaks banner markup, the fixed-colour
// .banner-build rule, and the eight buildIsStale cases.
//
// They did not fail. They were deleted because the feature they cover was, and a checker that
// keeps asserting a removed feature is a checker that has to be edited to make a build pass,
// which is how a suite hollows out. The stale-tab logic is still asserted twice over in the
// schedule tool's own suites, which are not part of this port.

console.log('\nnotLeaving  (a0.31: posture 2 arriving is not posture 5 leaving)');
{
  // This file has ok/bad and no is(). The first cut of this block was pasted from
  // the schedule logic suite, which does, and it threw at load rather than failing an assertion. Worth a
  // line: a harness is not portable just because the source it reads is.
  const yes = (c, why) => c ? ok(why) : bad('NOT TRUE: ' + why);
  const no  = (c, why) => !c ? ok(why) : bad('NOT FALSE: ' + why);
  // onTeam cannot separate them: both are inside their roster window, and in this fixture SBW is
  // posture 2 and TQL is leaving. The date is never read, because having a roster end AT ALL is
  // the statement. A leaver stops collecting new responsibilities the moment the end is set, not
  // the morning it arrives, since the entire point is to stop creating work that needs handing on.
  yes(notLeaving({ code:'PYR' }), 'posture 1, no roster end, is not leaving');
  yes(notLeaving({ code:'SBW', active:false }),
      'and NEITHER IS POSTURE 2: inactive with no date, and must stay pickable');
  no(notLeaving({ code:'TQL', active:true, roster_until:'2099-01-01' }),
     'a future roster end IS leaving, even with active still true, which is reachable by hand today');
  no(notLeaving({ roster_until:'2020-01-31' }), 'and so is a past one');
  no(notLeaving(null), 'no row is not a person to give a duty to');
  no(/sgtToday|slice\(0,10\)/.test(js.match(/function notLeaving\([\s\S]*?\n\}/)[0]),
     'notLeaving compares no dates: that is onTeam\'s job and duplicating it would re-open the hole');
  yes((js.match(/function notLeaving\(/g) || []).length === 1, 'exactly one of it');

  // THE LABEL. (left) and (inactive) were the whole vocabulary, so a leaver held as the current
  // value of a selector read identically to a trainee. Asserted on the escape path, which is the
  // only place a leaving person still appears.
  const kept = rosterOptions('TQL');
  yes(/value="TQL"/.test(kept), 'a leaver held as the current value still shows, so no edit blanks them');
  yes(/\(leaving /.test(kept), 'and is labelled leaving, with the date, not silently as inactive');
  no(/TQL[^<]*\(inactive\)/.test(kept), 'never as inactive, which is the word posture 2 owns');
}


// ---------------------------------------------------------------- the reorder RPCs
// ADDED BECAUSE A MUTATION SURVIVED. Breaking reorder so it renumbers only the row it was handed,
// leaving every other sort_order untouched, turned no suite red. RPC SURFACE above asserts these
// three names EXIST behind the seam -- which is the assertion that found them missing in the
// first place -- and nothing asserted what they do once they are there. Existence is not
// behaviour, and the arrows would have gone quietly wrong instead of quietly dead.
//
// BULK, NEVER PER-ROW, and that is the property worth pinning. One call carries the whole new
// order, so there is no moment where two rows share a sort_order or one is missing. A per-row
// implementation is the tempting wrong one: it looks equivalent and it leaves the table
// inconsistent between two clicks.
console.log('\nREORDER');
{
  core.reset();
  // Sign in as the admin first. Without a session every call below is refused for being
  // unauthenticated, and the three refusal assertions at the end would have passed for entirely
  // the wrong reason -- a green line saying "an empty order is refused" when what was refused
  // was the caller. Asserting the admin gate itself first, so the sign-in cannot silently lapse.
  !!core.RPCS.set_product_order({ p_codes: ['ARX'] }).error
    ? ok('a reorder with no session is refused before anything else is judged')
    : bad('a reorder went through with nobody signed in');
  const admin = core.db().people.filter(p => p.code === core.ADMIN_CODE)[0];
  core.auth.signInWithPassword({ email: admin.email, password: 'x' });
  const codes = () => core.db().products.slice()
    .sort((a, b) => a.sort_order - b.sort_order).map(p => p.code);
  const before = codes();
  const swapped = before.slice(); const t = swapped[0]; swapped[0] = swapped[1]; swapped[1] = t;
  const r = core.RPCS.set_product_order({ p_codes: swapped });
  !r.error ? ok('set_product_order accepts the whole new order')
           : bad('set_product_order refused a valid order: ' + r.error.message);
  codes().join(',') === swapped.join(',')
    ? ok('and the table comes back in exactly that order')
    : bad('the order did not take: got ' + codes().join(',') + ', want ' + swapped.join(','));
  // The mutation that survived: renumbering one row and leaving the rest. Caught by looking at
  // every position rather than at the one that moved.
  const orders = core.db().products.map(p => p.sort_order).sort((a, b) => a - b);
  orders.every((v, i) => v === i + 1)
    ? ok('every row is renumbered, 1..n with no gap and no duplicate')
    : bad('sort_order is not a clean 1..n after a reorder: ' + orders.join(','));
  // A partial list must not silently drop what it does not name.
  const r2 = core.RPCS.set_product_order({ p_codes: [before[2]] });
  !r2.error && core.db().products.length === before.length
    ? ok('a partial order keeps every row: nothing is dropped for not being named')
    : bad('a partial order lost rows');
  // And the refusals, because a reorder that accepts nonsense corrupts the table it orders.
  !!core.RPCS.set_product_order({ p_codes: [] }).error
    ? ok('an empty order is refused') : bad('an empty order was accepted');
  !!core.RPCS.set_product_order({ p_codes: [before[0], before[0]] }).error
    ? ok('and so is one naming the same row twice') : bad('a duplicated row was accepted');
  !!core.RPCS.set_product_order({ p_codes: ['NOPE'] }).error
    ? ok('and so is one naming a row that does not exist') : bad('an unknown code was accepted');
  // Hand the harness back as it was found: no session, seed store. A group that leaves a signed-in
  // admin behind makes every group after it easier to pass than it should be.
  core.auth.signOut();
  core.reset();
}

// ---------------------------------------------------------------- 12. read surface (gate 3a)
// New group. Every read this page performs is now a NAMED entry in the core.js registry rather
// than a select written out at the call site, and the two halves are asserted separately: the
// page must ask for a name, and the name must exist. A page asking for a read that is not in the
// registry gets {data:null} and renders an empty table, which looks like an empty dataset and not
// like a defect, so nothing downstream would have caught it.
console.log('\nREAD SURFACE');
{
  const named = [...new Set([...jsBare.matchAll(/core\.read\(\s*'([A-Za-z_]+)'/g)].map(m => m[1]))].sort();
  named.length
    ? ok(named.length + ' named reads: ' + named.join(', '))
    : bad('no core.read call sites at all: the page is not going through the registry');
  const absent = named.filter(n => !core.READS[n]);
  absent.length
    ? bad('read name(s) with no registry entry, which would silently return nothing: ' + absent.join(', '))
    : ok('and every one of them is in the registry');
  // The setup loader is the one dynamic site: it maps over specs and passes s.read. Those names
  // are literals in the spec array and ARE captured above, but the indirection is the same shape
  // as the RPC funnels, so it gets the same treatment: named, and asserted to be the only one.
  const computed = [...new Set([...jsBare.matchAll(/core\.read\(\s*([A-Za-z_$][\w$.]*)\s*\)/g)].map(m => m[1]))];
  const ALLOWED = new Set(['s.read']);
  const rogue = computed.filter(v => !ALLOWED.has(v));
  rogue.length
    ? bad('read called by an unrecognised variable, invisible to this check: ' + rogue.join(', '))
    : ok('the only computed read name is the setup loader spec, which carries literals');
  // And no select survives at the call sites. This is the drift the shared constants exist to
  // stop, so it is asserted rather than assumed: one copy, in the registry, or none.
  /\bsb\.from\(/.test(jsBare)
    ? bad('an inline table select survives in the page, which is how the two column lists drifted')
    : ok('no inline select anywhere in the page: the registry is the only read surface');
}

// ---------------------------------------------------------------- 13. shared column sets (gate 3a)
// The lots and lab_reports projections were written out in full in TWO files, and they had
// already drifted: this console selected 18 lot columns where the queue selected 20, missing
// edited_by and edited_at, so the admin edit tab could not show who last touched a row it was
// built to let the admin touch. Nothing covered it, because each file was internally consistent.
// Reconciled on the wider list and declared once in core.js.
console.log('\nSHARED COLUMN SETS');
{
  Array.isArray(core.LOT_COLS) && core.LOT_COLS.length
    ? ok('core.LOT_COLS is declared') : bad('core.LOT_COLS is missing');
  Array.isArray(core.LR_COLS) && core.LR_COLS.length
    ? ok('core.LR_COLS is declared') : bad('core.LR_COLS is missing');
  core.READS.lots.cols === core.LOT_COLS
    ? ok('the lots read uses the shared constant, not a copy of it')
    : bad('the lots read has its own column list again');
  core.READS.labReports.cols === core.LR_COLS
    ? ok('the lab_reports read uses the shared constant, not a copy of it')
    : bad('the lab_reports read has its own column list again');
  // The two columns this file was short. Named individually because they are the whole reason
  // the reconciliation happened, and a future trim that dropped them would otherwise pass.
  core.LOT_COLS.includes('edited_by') && core.LOT_COLS.includes('edited_at')
    ? ok('the reconciled lot list keeps edited_by and edited_at, which this console had dropped')
    : bad('edited_by/edited_at are missing from LOT_COLS again');
  core.LR_COLS.includes('edited_by') && core.LR_COLS.includes('edited_at')
    ? ok('and so does the report list')
    : bad('edited_by/edited_at are missing from LR_COLS again');
}

// NEW with the picker. A non-admin can now be chosen here, so the refusal is live again and gets
// the original's screen back. Asserted as markup and routing, and as sessions against core.js:
// switching identity must change who caller_is_admin answers for, or the screen is decoration.
console.log('\nVIEWING AS, AND THE DENIED SCREEN');
{
  const bare = html.replace(/<!--[\s\S]*?-->/g, '');
  const header = (bare.match(/<div class="header-right">[\s\S]*?<\/div>/) || [''])[0];
  /<select data-viewas onchange="viewAsChange\(this\.value\)">/.test(header)
    ? ok('the Viewing as picker is in the page header') : bad('the Viewing as picker is missing from the header');
  const denied = (bare.match(/<div id="denied" class="auth-screen"[\s\S]*?<div id="app">/) || [''])[0];
  /Not authorised/.test(denied) && /admin only/.test(denied)
    ? ok('the denied screen is restored, with the original wording') : bad('there is no denied screen for a non-admin');
  /<select data-viewas/.test(denied)
    ? ok('and it carries the picker, so a refused person can switch back') : bad('the denied screen strands a non-admin: no picker on it');
  !/loginScreen|signOut\(|auth-input|auth-btn/.test(bare)
    ? ok('the login screen is NOT restored, only the refusal') : bad('login markup has come back with the denied screen');
  /if \(!me \|\| !admin\)\{\s*document\.getElementById\('deniedEmail'\)[^\n]*\n\s*showScreen\('denied'\); return;/.test(jsBare)
    ? ok('a non-admin is routed to the denied screen, never to loadAll') : bad('a non-admin is not routed to the denied screen');
  /function viewAsChange\(code\)\{ core\.setViewingAs\(code\); location\.reload\(\); \}/.test(jsBare)
    ? ok('a change goes to core.js and reloads') : bad('the picker does not hand its choice to core.js');
  /core\.signInDefault\(core\.ADMIN_CODE\)/.test(jsBare)
    ? ok('the page signs in through signInDefault, the admin when nobody is picked')
    : bad('the page does not sign in through the path that reads the picker');
  ['auth-screen','auth-card','auth-icon','auth-title','auth-sub','auth-msg','viewas'].every(c => new RegExp('\\.' + c + '\\{').test(cssBare))
    ? ok('every class the denied screen and the picker use has a rule') : bad('a class on the denied screen or the picker has no rule');

  const as = c => { core.setViewingAs(c); core.signInDefault(core.ADMIN_CODE); };
  as(null);
  core.RPCS.caller_is_admin().data === true
    ? ok('nobody picked: the console opens as the admin') : bad('with nobody picked the console is not the admin');
  as('IPB');
  core.RPCS.caller_is_admin().data === false && core.RPCS.caller_code().data === 'IPB'
    ? ok('pick a chemist and the session IS the chemist, so this page refuses them')
    : bad('picking a chemist did not change the session');
  as(core.ADMIN_CODE);
  core.RPCS.caller_is_admin().data === true ? ok('and picking the admin back restores the console') : bad('picking the admin back did not');
  core.setViewingAs(null);
}

// NEW with the branched update_lot. The Edit tab's full-edit of a LOCKED lot was refused by
// core.js outright, so the panel offered an edit it could never save. Now: allowed to the admin,
// logged, refused to everyone else, and refused to everyone on a frozen lot.
console.log('\nADMIN EDIT OF A LOCKED LOT');
{
  core.reset();
  const locked = l => !!l.frozen || (l.is_use_test && !!l.d2) || (!l.is_use_test && !!l.lab_report_number) || (!l.is_use_test && !!l.experiment_end);
  const lot = core.db().lots.filter(l => !l.frozen && locked(l) && !l.is_use_test)[0];
  const frozen = core.db().lots.filter(l => l.frozen)[0];
  const edit = (l, remarks) => core.RPCS.update_lot({ p_id: l.id, p_lot_type: l.lot_type, p_purpose: l.purpose,
    p_is_use_test: l.is_use_test, p_lab_report_number: l.lab_report_number, p_remarks: remarks,
    p_reserved_by: l.reserved_by, p_d1: l.d1, p_d2: l.d2, p_d3: l.d3,
    p_experiment_start: l.experiment_start, p_experiment_end: l.experiment_end });
  const log = () => core.db().admin_edit_log || [];
  core.setViewingAs(lot.reserved_by); core.signInDefault();
  !!edit(lot, 'owner tries').error && log().length === 0
    ? ok('the owner cannot edit their own locked lot, and nothing is logged')
    : bad('a non-admin edited a locked lot');
  core.setViewingAs(core.ADMIN_CODE); core.signInDefault();
  const r = edit(lot, 'admin correction');
  !r.error ? ok('the admin can edit a locked lot, which is the whole Edit tab')
           : bad('the admin was refused a locked lot: ' + r.error.message);
  const row = log().filter(x => x.lot_number === lot.lot_number)[0];
  row && row.edited_by === core.ADMIN_CODE
    ? ok('and the edit writes an admin_edit_log row, keyed on lot_number, naming the editor')
    : bad('the admin edit of a locked lot wrote no admin_edit_log row');
  row && row.before && row.after && row.before.remarks !== 'admin correction' && row.after.remarks === 'admin correction'
    ? ok('the row carries the lot before and after the edit') : bad('the log row does not record what changed');
  const n = log().length;
  // An owner who can write at all: an open lot held by a posture 2, 5 or 3 person is refused for
  // who they are, which would pass this line for the wrong reason.
  const writer = c => { const p = core.db().people.filter(x => x.code === c)[0]; return p && p.active && (!p.roster_until || p.roster_until >= core.today()); };
  const open = core.db().lots.filter(l => !locked(l) && writer(l.reserved_by))[0];
  core.setViewingAs(open.reserved_by); core.signInDefault();
  !edit(open, 'ordinary edit').error && log().length === n
    ? ok('an edit of an OPEN lot is not logged: the log is for locked edits only')
    : bad('an ordinary edit of an open lot wrote to the admin log, or was refused');
  core.setViewingAs(core.ADMIN_CODE); core.signInDefault();
  !!edit(frozen, 'admin on frozen').error
    ? ok('a frozen lot refuses even the admin') : bad('the admin edited a frozen lot');
  core.setViewingAs(null); core.reset();
}

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall checks pass\n');
process.exit(fails ? 1 : 0);
