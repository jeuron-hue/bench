/*
  seed.js  -  DEV ONLY. Builds the bench dataset.

  Not part of the application. core.js calls BENCH_SEED() once, when the store is
  empty or has been reset, and never again; every later change goes through an RPC.
  Nothing here is imported by a page for any other purpose.

  DETERMINISTIC. One seeded PRNG (mulberry32, fixed seed), no Date, no Math.random.
  The same seed gives the same dataset on every machine and every reload, which is
  the only way a screenshot or a checker run means anything.

  Counts and date spread follow the audit's seed plan (section 6). Window
  09/03/26 - 31/07/26, 145 days, 21 whole weeks, anchored on core.js's pinned
  2026-06-10 which is week 14.
*/
(function (global) {
'use strict';

// ---------- the PRNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------- window ----------
var START = '2026-03-09';          // a Monday
var END   = '2026-07-31';          // a Friday
var TODAY = '2026-06-10';          // must match core.js's pinned NOW
var YEAR2 = 26;

function d2n(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function n2d(n)   { return new Date(n).toISOString().slice(0, 10); }
function addDays(iso, k) { return n2d(d2n(iso) + k * 86400000); }
function daysBetween(a, b) { return Math.round((d2n(b) - d2n(a)) / 86400000); }

var SPAN = daysBetween(START, END);          // 144
var WEEKS = [];
for (var w = 0; w * 7 <= SPAN; w++) WEEKS.push(addDays(START, w * 7));   // 21 Mondays

function BENCH_SEED() {
  var rnd = mulberry32(20260610);
  var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
  var intBetween = function (lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); };

  /*
    DENSITY GRADIENT. Real quarters bunch toward the present, so a date drawn for the
    window is pulled toward the anchor: thin at both edges, heaviest around week 14.
    Without this the wall reads as evenly-sprinkled test data, which is exactly what
    it would be.
  */
  function dateInWindow() {
    var a = rnd(), b = rnd();
    var t = (a + b + rnd()) / 3;                     // triangular, centred
    var centre = daysBetween(START, TODAY) / SPAN;   // 0.64
    var v = Math.min(0.999, Math.max(0, t * 0.8 + centre * 0.2));
    return addDays(START, Math.floor(v * SPAN));
  }
  function workday(iso) {
    var dow = new Date(d2n(iso)).getUTCDay();
    if (dow === 0) return addDays(iso, 1);
    if (dow === 6) return addDays(iso, 2);
    return iso;
  }

  // ================= people =================
  // Eight, with every posture the tools distinguish present exactly once:
  // an admin, a posture-2 trainee, a leaver whose date has passed (posture 3), a
  // posture-5 leaver whose date is still ahead, two mentor pairs, and one person with
  // no relation at all.
  var people = [
    { code:'HZO', full_name:'Helena Ostrow',   email:'hzo@bench.local', active:true,  admin:true,  mentor:null,  roster_until:null,         has_login:true  },
    { code:'IPB', full_name:'Ines Barbosa',    email:'ipb@bench.local', active:true,  admin:false, mentor:null,  roster_until:null,         has_login:true  },
    { code:'MJD', full_name:'Marcus Devlin',   email:'mjd@bench.local', active:true,  admin:false, mentor:null,  roster_until:null,         has_login:true  },
    { code:'TQL', full_name:'Tomas Lindqvist', email:'tql@bench.local', active:true,  admin:false, mentor:null,  roster_until:null,         has_login:true  },
    { code:'SBW', full_name:'Sarah Whitlock',  email:'sbw@bench.local', active:true,  admin:false, mentor:null,  roster_until:null,         has_login:true  },
    // posture 2: on the roster, reads everything, writes nothing
    { code:'PYR', full_name:'Priya Raman',     email:'pyr@bench.local', active:false, admin:false, mentor:'MJD', roster_until:null,         has_login:true  },
    // posture 5, offboarding: inactive with a roster end still ahead. Still here, still holds
    // work, still on every display, but no longer offered anything new. Last day is a month
    // after the anchor.
    { code:'NFH', full_name:'Nadia Fahim',     email:'nfh@bench.local', active:false, admin:false, mentor:'TQL', roster_until:'2026-07-10', has_login:true  },
    // THE LEAVER. active TRUE with a past date, which is the whole point of the lever
    { code:'CJR', full_name:'Callum Reyes',    email:'cjr@bench.local', active:true,  admin:false, mentor:null,  roster_until:'2026-05-22', has_login:false }
  ];
  var CODES   = people.map(function (p) { return p.code; });
  var BENCHERS = ['IPB','MJD','TQL','SBW','NFH','PYR','CJR'];   // everyone but the admin

  // ================= products =================
  var PRODUCT_CODES = ['ARX','BQL','CYT','DPH','EMR','FLT','GVA','HXN','ITR','JMS','KLD','MTQ','NVP'];
  var HUES = ['#e8a33d','#3a6aee','#3fa672','#c2544d','#8a63d2','#d98cb3','#4aa3a3','#b3893a','#6e7bd6',null,null,null,null];
  var products = PRODUCT_CODES.map(function (c, i) {
    return { code:c, colour:HUES[i], active: i < 9, sort_order: i + 1 };   // 9 active, 4 retired
  });
  var LIVE = products.filter(function (p) { return p.active; }).map(function (p) { return p.code; });

  // ================= lookups =================
  var task_statuses = [
    // needs_start FALSE on Planned, and this is the tick that makes the sixth alert reachable.
    // The flag means "this status asserts work has begun". Planned asserts the opposite, so a
    // Planned task whose start date has passed is the dashboard's should-have-started case: the
    // dates say under way and the status says pending. With the flag set true here that bucket
    // was unreachable in the seeded data -- the pulsing red never fired on any row -- and the
    // fifteen unscheduled Planned tasks additionally failed the page's own startOk(), which
    // refuses a needs_start status on a task with no dates. sched_logic.cjs's dashboard fixture
    // pairs them the same way and says why: Planned does not carry it, Running does.
    { value:'Planned',           colour:'#3a6aee', texture:'solid',   is_terminal:false, cancelled:false, active:true,  needs_start:false,  sort_order:1 },
    { value:'Running',           colour:'#3fa672', texture:'solid',   is_terminal:false, cancelled:false, active:true,  needs_start:true,  sort_order:2 },
    { value:'Documentation',     colour:'#8a63d2', texture:'solid',   is_terminal:true,  cancelled:false, active:true,  needs_start:false, sort_order:3 },
    { value:'Completed',         colour:null,      texture:'faded',   is_terminal:true,  cancelled:false, active:true,  needs_start:false, sort_order:4 },
    { value:'Cancelled',         colour:null,      texture:'faded',   is_terminal:false, cancelled:true,  active:true,  needs_start:false, sort_order:5 },
    { value:'Retired',           colour:'#888888', texture:'outline', is_terminal:false, cancelled:false, active:false, needs_start:false, sort_order:6 }
  ];
  var absence_types = [
    { value:'Annual Leave',  code:'AL', active:true },
    { value:'Medical Leave', code:'ML', active:true },
    { value:'Course',        code:'CO', active:true },
    { value:'Conference',    code:'CF', active:true },
    { value:'Off in lieu',   code:'OL', active:true },
    { value:'Sabbatical',    code:null, active:false }
  ];
  var lot_types = [
    { value:'Synthesis',    active:true  },
    { value:'Purification', active:true  },
    { value:'Analysis',     active:true  },
    { value:'Stability',    active:true  },
    { value:'Use Test',     active:true  },
    { value:'Reference',    active:false }
  ];
  var lr_types = [
    { value:'Method',        active:true  },
    { value:'Batch release', active:true  },
    { value:'Stability',     active:true  },
    { value:'Investigation', active:true  },
    { value:'Transfer',      active:false }
  ];

  // ================= instruments =================
  var instruments = [
    { code:'LC1', name:'HPLC-1', active:true,  bookable:true,  owner_main:'TQL', owner_backup:'IPB' },
    { code:'LC2', name:'HPLC-2', active:true,  bookable:true,  owner_main:'IPB', owner_backup:null  },
    { code:'LC3', name:'HPLC-3', active:true,  bookable:true,  owner_main:'TQL', owner_backup:null  },
    { code:'GC1', name:'GC-MS-1',active:true,  bookable:true,  owner_main:'MJD', owner_backup:'SBW' },
    { code:'IC1', name:'ICP-MS-1',active:true, bookable:true,  owner_main:'IPB', owner_backup:null  },
    { code:'KF1', name:'KF-1',   active:true,  bookable:true,  owner_main:'SBW', owner_backup:null  },
    { code:'DS1', name:'DIS-1',  active:true,  bookable:false, owner_main:'SBW', owner_backup:null  },
    { code:'UV1', name:'UV-1',   active:true,  bookable:true,  owner_main:'NFH', owner_backup:null  },
    { code:'NM1', name:'NMR-1',  active:false, bookable:false, owner_main:null,  owner_backup:null  }   // unowned and inactive
  ];

  var standing_roles = [
    { code:'SAF', name:'Safety rep',    main:'MJD', backup:'IPB', active:true,  sort_order:10 },
    { code:'QAL', name:'QA liaison',    main:'SBW', backup:null,  active:true,  sort_order:20 },
    { code:'CAL', name:'Calibration',   main:'TQL', backup:'NFH', active:true,  sort_order:30 },
    { code:'WST', name:'Waste officer', main:'IPB', backup:null,  active:true,  sort_order:40 },
    { code:'FIR', name:'Fire warden',   main:'NFH', backup:null,  active:false, sort_order:50 }
  ];

  /*
    PUBLIC HOLIDAYS. Two are calendar-derived and correct: Easter 2026 falls on
    5 April, so Good Friday is the 3rd, and Labour Day is fixed at 1 May. The other
    three are PLACEHOLDERS - the movable Islamic and Buddhist feasts are set by
    gazette and are not derivable. Replace them from the official 2026 gazette
    before this dataset is used for anything but a bench.
  */
  var public_holidays = [
    { holiday_date:'2026-03-21', name:'Placeholder holiday A (verify against gazette)' },
    { holiday_date:'2026-04-03', name:'Good Friday' },
    { holiday_date:'2026-05-01', name:'Labour Day' },
    { holiday_date:'2026-05-27', name:'Placeholder holiday B (verify against gazette)' },
    { holiday_date:'2026-06-19', name:'Placeholder holiday C (verify against gazette)' }
  ];

  // ================= duty types and assignments =================
  var duty_types = [
    { code:'HK',  name:'Housekeeping',      colour:'#3fa672', show_final_days:null, active:true },
    { code:'SR',  name:'Sample receipt',    colour:'#3a6aee', show_final_days:null, active:true },
    { code:'INS', name:'Instrument checks', colour:'#e8a33d', show_final_days:null, active:true },
    { code:'OOS', name:'OOS review',        colour:'#c2544d', show_final_days:3,    active:true }   // late reminder
  ];
  var duty_assignments = [];
  var daId = 1;
  var rota = ['MJD','TQL','IPB','SBW','NFH','CJR'];
  WEEKS.forEach(function (mon, wi) {
    duty_types.forEach(function (dt, di) {
      // two deliberate gaps, and one week where the same person holds two duties
      if ((wi === 5 && di === 2) || (wi === 12 && di === 3)) return;
      var who = rota[(wi + di * 2) % rota.length];
      if (wi === 9 && di === 1) who = rota[(wi + 0) % rota.length];   // doubled up
      duty_assignments.push({ id: daId++, duty_type: dt.code, person: who,
                              start_date: mon, end_date: addDays(mon, 6), note: null });
    });
  });

  // ================= campaigns and milestones =================
  var CAMPAIGNS = [
    { product:'ARX', title:'ARX scale-up'        },
    { product:'BQL', title:'BQL method transfer' },
    { product:'CYT', title:'CYT stability'       },
    { product:'DPH', title:'DPH impurity work'   },
    { product:'EMR', title:'EMR process fit'     },
    { product:'FLT', title:'FLT qualification'   },
    { product:'GVA', title:'GVA feasibility'     }
  ];
  var milestones = [], msId = 1;
  CAMPAIGNS.forEach(function (c, ci) {
    for (var k = 0; k < 5; k++) {                       // 5 per campaign = 35
      var start = workday(addDays(START, Math.floor((ci * 3 + k * 27 + 5) % (SPAN - 20))));
      var end   = addDays(start, intBetween(6, 24));
      // Eight of the thirty-five put the approve mark on the hard deadline, which is
      // the collision the nudge exists for and the commonest real-world case.
      var collide = (ci * 5 + k) % 4 === 0;
      milestones.push({ id: msId++, product: c.product, title: c.title + ' M' + (k + 1),
                        co_lead_code: pick(BENCHERS), start_date: start, end_date: end,
                        hard_deadline: end, review_due: addDays(end, -4),
                        approve_due: collide ? end : addDays(end, 2) });
    }
  });

  // ================= schedule items =================
  // 120: 70 closed out, 35 live, 15 unscheduled (no start date at all).
  //
  // THE PAST IS CLOSED, and that is the whole shape of this section. Work whose dates sit behind
  // the anchor lands in a terminal status, because a quarter that ran well leaves finished work
  // behind it rather than a wall of red. The first cut let the PRNG place live work anywhere in
  // the window, which put thirty open tasks in the past and made the dashboard read "30 late"
  // against 120. That is not a fixture exercising the red paths, it is one drowning in them:
  // with thirty red rows nobody can tell which is the case worth keeping, and a regression that
  // added a thirty-first would be invisible.
  //
  // So the overdue set is small, deliberate, and written out below one shape at a time.
  var schedule_items = [], item_owners = [], siId = 1;

  // A start far enough back that the longest span this seeder generates still ends before the
  // anchor. Closed work has to be genuinely closed, not merely labelled that way.
  function pastStart() {
    return workday(addDays(START, Math.floor(rnd() * (daysBetween(START, TODAY) - 26))));
  }
  // Live work starts a fortnight behind the anchor at the earliest, so every bar is either
  // running now or still ahead. Nothing generated here can be late by accident; everything late
  // in this dataset is late on purpose and is listed in LATE below.
  function liveStart() {
    return workday(addDays(TODAY, -12 + Math.floor(rnd() * 40)));
  }

  function pushItem(status, start) {
    var id = siId++;
    var row = { id:id, product: pick(LIVE), title: 'Task ' + id,
                status: status, effort_hours: pick([2, 4, 6, 8, 8, 8]),
                start_date: null, end_date: null, due_date: null, reference: null };
    if (start) {
      row.start_date = start;
      row.end_date   = addDays(start, intBetween(2, 18));
      // Never before the end date here. A hard deadline that lands inside the bar is a real
      // shape and the tool must draw it, but it is a LATE shape, so it is made deliberately in
      // LATE rather than scattered by the PRNG through work that is supposed to be healthy.
      row.due_date   = addDays(row.end_date, intBetween(0, 10));
    }
    schedule_items.push(row);
    var n = rnd() < 0.18 ? 2 : 1;                       // some multi-owner tasks
    var seen = {};
    for (var i = 0; i < n; i++) {
      var c = pick(BENCHERS);
      if (seen[c]) continue;
      seen[c] = true;
      item_owners.push({ item_id: id, person_code: c });
    }
    return row;
  }
  var i;
  for (i = 0; i < 70; i++) pushItem(pick(['Completed','Documentation','Cancelled']), pastStart());
  for (i = 0; i < 35; i++) {
    var live = pushItem(pick(['Planned','Running']), liveStart());
    // Guarantee the bar reaches the anchor. A two-day task starting a fortnight back would
    // otherwise end before today and read as late, which is the exact accident this section
    // exists to prevent -- and it did happen: one stray survived the first rewrite and only
    // the bucket report caught it, because one red row among nine looks like the fixture.
    if (live.end_date < TODAY) {
      live.end_date = addDays(TODAY, intBetween(1, 16));
      live.due_date = addDays(live.end_date, intBetween(0, 10));
    }
  }
  for (i = 0; i < 15; i++) pushItem('Planned', null);   // the sixth bucket

  // Ten archived: terminal AND last date more than six weeks back, so they fall off the wall.
  for (i = 0; i < 10; i++) {
    var ar = schedule_items[i];
    ar.status = 'Completed';
    ar.start_date = addDays(TODAY, -95 - i);
    ar.end_date   = addDays(TODAY, -60 - i);
    ar.due_date   = ar.end_date;
  }
  // Three crossing each window edge, so clipping is exercised in both directions. Both runs sit
  // inside the closed-out block, so neither can turn into an accidental overdue.
  for (i = 20; i < 23; i++) {
    schedule_items[i].start_date = addDays(START, -20 - i);
    schedule_items[i].end_date   = addDays(START, 10);
    schedule_items[i].due_date   = schedule_items[i].end_date;
  }
  for (i = 30; i < 33; i++) {
    schedule_items[i].start_date = addDays(END, -12);
    schedule_items[i].end_date   = addDays(END, 25 + i);
    schedule_items[i].due_date   = schedule_items[i].end_date;
  }

  // ---- THE OVERDUE SET ----
  // Seven rows, each a named shape rather than a random late date, and each pinned to a person
  // so the spread across bubbles is a property of the fixture and not of the PRNG. Six are late;
  // the seventh is the other red and must NOT be.
  //
  // Indices are into the LIVE block (70..104), so these overwrite work that was healthy rather
  // than reopening something the closed-out block already finished.
  var LATE = [
    // Two very overdue: last date more than six weeks back, which is what lifts them out of a
    // plain red row into the wall's own "Very overdue" section.
    { i:70, who:'MJD', status:'Running', s:-88, e:-64, d:-64 },
    { i:71, who:'CJR', status:'Running', s:-80, e:-52, d:-52 },
    // Plain overdue: the bar ended and the work did not.
    { i:72, who:'TQL', status:'Running', s:-30, e:-11, d:-11 },
    { i:73, who:'SBW', status:'Running', s:-24, e:-4,  d:-4  },
    // PAST THE HARD DEADLINE WITH THE BAR STILL RUNNING. end_date is ahead of the anchor and
    // due_date is behind it. This is the shape dbLateMark exists for: printing end_date blindly
    // puts the word "overdue" above a date that has not happened yet, which is the defect that
    // function was written to fix. Nothing else in this dataset has it.
    { i:74, who:'NFH', status:'Running', s:-15, e:12,  d:-3  },
    // One more plain overdue, so the set spans five people rather than clustering.
    { i:75, who:'PYR', status:'Planned', s:-20, e:-6,  d:-6  },
    // SHOULD HAVE STARTED, and it is here to be the control. Start date behind the anchor,
    // status still the one carrying needs_start, end date ahead. dbLate must return FALSE for
    // this row: it is the pulsing red, not the bold one, and a change that collapsed the two
    // alerts into one would show up as this task moving buckets.
    { i:76, who:'IPB', status:'Planned', s:-6,  e:9,   d:16  }
  ];
  LATE.forEach(function (L) {
    var t = schedule_items[L.i];
    t.status     = L.status;
    t.start_date = workday(addDays(TODAY, L.s));
    t.end_date   = addDays(TODAY, L.e);
    t.due_date   = addDays(TODAY, L.d);
    // Pin the owner: drop whatever the generator gave this row and hand it to one person, so
    // each shape lands in a known bubble and the per-person counts are a fact about the seed.
    item_owners = item_owners.filter(function (o) { return o.item_id !== t.id; });
    item_owners.push({ item_id: t.id, person_code: L.who });
  });

  // ---- THE UNOWNED CASE ----
  // Two tasks nobody holds. The dashboard and the overdue board both carry an UNOWNED bucket,
  // and before this the seed put nothing in it: the one place a per-person rollup can lose a
  // task outright was the one place the fixture never looked. One of the two is late, so the
  // bucket has a red row and not just a heading.
  [77, 78].forEach(function (ix, k) {
    var t = schedule_items[ix];
    item_owners = item_owners.filter(function (o) { return o.item_id !== t.id; });
    if (k === 0) {                                   // late, and held by nobody
      t.status     = 'Running';
      t.start_date = workday(addDays(TODAY, -26));
      t.end_date   = addDays(TODAY, -9);
      t.due_date   = addDays(TODAY, -9);
    }
  });

  // ================= absences, training, bookings, maintenance =================
  // Five each across the whole roster, admin included: everybody takes leave.
  var absences = [], abId = 1;
  CODES.forEach(function (code) {
    for (var k = 0; k < 5; k++) {                       // 8 x 5 = 40
      var s = workday(dateInWindow());
      absences.push({ id: abId++, person_code: code, absence_type: pick(absence_types.filter(function (t) { return t.active; })).value,
                      start_date: s, end_date: addDays(s, intBetween(0, 4)) });
    }
  });
  /*
    Three of the forty are OVERWRITTEN rather than appended, so the count stays at the
    planned 40: a clash pair on identical days (which the clash rule partitions on
    days, not booleans) and one absence straddling the 3 April public holiday.
  */
  absences[5]  = { id: absences[5].id,  person_code:'IPB', absence_type:'Annual Leave', start_date:'2026-04-13', end_date:'2026-04-17' };
  absences[10] = { id: absences[10].id, person_code:'MJD', absence_type:'Annual Leave', start_date:'2026-04-13', end_date:'2026-04-17' };
  absences[20] = { id: absences[20].id, person_code:'SBW', absence_type:'Annual Leave', start_date:'2026-04-01', end_date:'2026-04-07' };

  var training = [], trId = 1;
  BENCHERS.forEach(function (code) {
    for (var k = 0; k < 2; k++) {                       // 14, plus two below = 16
      var s = workday(dateInWindow());
      training.push({ id: trId++, person_code: code, title: pick(['GMP refresher','Chromatography','Data integrity','Safety induction']),
                      start_date: s, end_date: addDays(s, intBetween(0, 2)) });
    }
  });
  training.push({ id: trId++, person_code:'PYR', title:'Bench induction', start_date:'2026-03-16', end_date:'2026-03-20' });
  training.push({ id: trId++, person_code:'HZO', title:'Auditor training', start_date:'2026-05-11', end_date:'2026-05-12' });

  var instrument_bookings = [], ibId = 1;
  var BOOKABLE = instruments.filter(function (x) { return x.bookable && x.active; });
  for (i = 0; i < 30; i++) {
    var bs = workday(dateInWindow());
    instrument_bookings.push({ id: ibId++, instrument_code: pick(BOOKABLE).code,
                               person_code: pick(BENCHERS), start_date: bs,
                               end_date: addDays(bs, intBetween(0, 3)) });
  }

  var instrument_maintenance = [], mmId = 1;
  for (i = 0; i < 12; i++) {
    var mstart = workday(addDays(START, Math.floor((i * 12 + 4) % (SPAN - 5))));
    instrument_maintenance.push({ id: mmId++, instrument_code: instruments[i % instruments.length].code,
                                  start_date: mstart, end_date: addDays(mstart, intBetween(0, 2)),
                                  note: pick(['PM','Calibration','Service call']) });
  }

  // ================= the register =================
  // 60 lots, ~3 a week, spread over the live products. seq is per product per year
  // and ascends from 1, which is the rule the reserve RPC re-implements.
  var lots = [], lotId = 1, seqOf = {};
  var LIVE_TYPES = lot_types.filter(function (t) { return t.active; }).map(function (t) { return t.value; });
  for (i = 0; i < 60; i++) {
    var prod = LIVE[i % LIVE.length];
    seqOf[prod] = (seqOf[prod] || 0) + 1;
    var isUT = rnd() < 0.3;
    var reserved = workday(dateInWindow());
    var lot = { id: lotId++, product: prod, year: YEAR2, seq: seqOf[prod],
                lot_number: prod + '-' + YEAR2 + '-' + String(seqOf[prod]).padStart(4, '0'),
                lot_type: isUT ? 'Use Test' : pick(LIVE_TYPES.filter(function (t) { return t !== 'Use Test'; })),
                purpose: pick(['Stability pull','Incoming assay','Method precision','Cleaning verification','Impurity profile','Retain']),
                is_use_test: isUT, lab_report_number: null,
                remarks: rnd() < 0.2 ? 'Repeat of an earlier pull.' : null,
                reserved_by: pick(BENCHERS), reserved_at: reserved + 'T02:00:00.000Z',
                edited_by: null, edited_at: null,
                d1: null, d2: null, d3: null,
                experiment_start: null, experiment_end: null, frozen: false };
    var r = rnd();
    if (isUT) {
      lot.d1 = reserved;
      if (r < 0.55) { lot.d2 = addDays(reserved, 5); }                       // locked
      if (r < 0.25) { lot.d3 = addDays(reserved, 12); }                      // locked, complete
      // 0.25 <= r < 0.55 leaves d2 set and d3 empty, which is the QC pending state
    } else {
      lot.experiment_start = reserved;
      if (r < 0.45) lot.experiment_end = addDays(reserved, intBetween(4, 20));   // locked
    }
    if (r > 0.94) lot.frozen = true;
    lots.push(lot);
  }

  // 35 lab reports, newest number first when rendered.
  var lab_reports = [], lrId = 1;
  var LR_LIVE = lr_types.filter(function (t) { return t.active; }).map(function (t) { return t.value; });
  for (i = 0; i < 35; i++) {
    var created = workday(dateInWindow());
    var prd = LIVE[(i * 3) % LIVE.length];
    lab_reports.push({ id: lrId++, lr_number: 'LR-' + YEAR2 + '-' + String(i + 1).padStart(4, '0'),
                       seq: i + 1, year: YEAR2, product: prd, revision: 1,
                       lr_type: pick(LR_LIVE),
                       subject: pick(['Batch release','Method transfer','Stability interim','Dissolution profile','Impurity investigation']),
                       report_date: null, created_by: pick(BENCHERS),
                       created_at: created + 'T02:00:00.000Z',
                       edited_by: null, edited_at: null, lr_display: '', standalone: rnd() < 0.35 });
  }

  /*
    LINK AND SIGN, in that order, because the sign gate is two-way: a non-standalone
    report needs at least one lot linked before it can be signed, and a standalone
    one needs none. Seeding a signed report that violates its own gate would produce
    a dataset the RPCs would refuse to reproduce.
  */
  var openLots = lots.filter(function (l) { return !l.is_use_test && !l.experiment_end && !l.frozen; });
  lab_reports.forEach(function (lr, k) {
    if (lr.standalone) return;
    var match = openLots.filter(function (l) { return l.product === lr.product && !l.lab_report_number; });
    if (match.length && k % 2 === 0) match[0].lab_report_number = lr.lr_number;   // this also locks the lot
  });
  lab_reports.forEach(function (lr, k) {
    var linked = lots.filter(function (l) { return l.lab_report_number === lr.lr_number; }).length;
    var signable = lr.standalone ? (linked === 0) : (linked > 0);
    if (signable && k % 3 === 0) lr.report_date = addDays(lr.created_at.slice(0, 10), 21);
  });
  // Three carrying a revision, which is what Undo revision acts on.
  var lr_archive = [];
  [4, 11, 19].forEach(function (idx) {
    var lr = lab_reports[idx];
    var prior = JSON.parse(JSON.stringify(lr));
    prior.report_date = prior.report_date || addDays(prior.created_at.slice(0, 10), 15);
    lr_archive.push(prior);
    lr.revision = 2;
    lr.lr_display = ' R02';
    lr.report_date = null;
  });

  return {
    __v: 1,
    people: people, products: products,
    task_statuses: task_statuses, absence_types: absence_types,
    lot_types: lot_types, lr_types: lr_types,
    instruments: instruments, standing_roles: standing_roles,
    public_holidays: public_holidays,
    duty_types: duty_types, duty_assignments: duty_assignments,
    milestones: milestones,
    schedule_items: schedule_items, item_owners: item_owners,
    absences: absences, training: training,
    instrument_bookings: instrument_bookings,
    instrument_maintenance: instrument_maintenance,
    lots: lots, lab_reports: lab_reports, lr_archive: lr_archive
  };
}

global.BENCH_SEED = BENCH_SEED;

})(typeof window !== 'undefined' ? window : globalThis);
