/*
  core.js  -  the bench backend.

  Everything the three tools used to reach across the network now lives here: the
  read registry, the RPCs, the auth surface and the clock. There is no server. The
  whole dataset is a plain object held in localStorage, seeded once by seed.js.

  WHY A REGISTRY AND NOT A QUERY LAYER. The audit swept every read in the original
  three files: 32 select calls, ONE .eq (a constant), 11 .order (never more than two
  keys), and nothing else - no .in, .or, .gt, .limit, .range, .single, and no joins
  or embedded selects at all. Every read is a constant with no runtime parameter.
  So this is a table of constant named reads and one executor, and it needs exactly
  three capabilities: column projection, up to two order keys, one constant equality.
  Adding a fourth is a change of shape, not a change of degree - say so out loud.

  THE CLOCK IS PINNED. now() and nowMs() are the only clock in the system, fixed at
  2026-06-10. The 8 bare `new Date()` sites route through here. The 11 `new Date(arg)`
  sites are PARSING and must never route through here: they turn a stored string into
  a date and have nothing to do with what day it is.
*/
(function (global) {
'use strict';

// ============================================================
// 1. THE CLOCK  -  one pinned NOW, and it is the only one
// ============================================================
// 2026-06-10, Singapore. Week 14 of the 21-week seed window (09/03/26 - 31/07/26),
// which leaves 13 weeks of past and 7 of future inside the wall.
var PINNED_MS = Date.UTC(2026, 5, 10, 1, 0, 0);   // 09:00 SGT = 01:00 UTC

function now()   { return new Date(PINNED_MS); }
function nowMs() { return PINNED_MS; }

// The Singapore civil date of the pinned instant, as YYYY-MM-DD and as a 2-digit year.
function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now());
}
function year2() {
  return parseInt(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore', year: 'numeric'
  }).format(now()), 10) % 100;
}

// ============================================================
// 2. STORAGE  -  one key, every page, and a silent storageFallback
// ============================================================
/*
  ONE KEY for the whole dataset, so the queue, the schedule and the console all see
  the same rows and a write on one is visible on the next.

  THE SILENT storageFallback IS THE REQUIREMENT, not a nicety. Under file:// Chrome throws a
  SecurityError on the localStorage GETTER, before you ever call getItem, so the
  access itself has to sit inside try/catch - a feature test that reads the property
  is already the crash. Private mode, disabled site data and a full quota each fail
  somewhere different. In every case the store falls back to memory, the page works
  for the session, and nothing is thrown at the caller. storageState() reports which
  mode is live so a page can say so if it wants to; nothing is obliged to look.
*/
var STORE_KEY = 'bench.store.v1';
var memoryStore = null;
var storageMode = 'unknown';       // 'local' | 'memory'
var storageWhy  = '';

function rawStorage() {
  try {
    var ls = global.localStorage;              // this line alone throws under file://
    if (!ls) return null;
    var probe = STORE_KEY + '.probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch (e) {
    storageWhy = (e && e.name) ? e.name : 'unavailable';
    return null;
  }
}

function readPersisted() {
  var ls = rawStorage();
  if (!ls) { storageMode = 'memory'; return null; }
  try {
    var s = ls.getItem(STORE_KEY);
    if (!s) return null;
    storageMode = 'local';
    return JSON.parse(s);
  } catch (e) {
    storageWhy = 'unreadable: ' + ((e && e.message) || 'parse failed');
    storageMode = 'memory';
    return null;
  }
}

function writePersisted(obj) {
  var ls = rawStorage();
  if (!ls) { storageMode = 'memory'; return false; }
  try {
    ls.setItem(STORE_KEY, JSON.stringify(obj));
    storageMode = 'local';
    return true;
  } catch (e) {
    // Quota, most likely. Keep going in memory rather than losing the session.
    storageWhy = (e && e.name) ? e.name : 'write refused';
    storageMode = 'memory';
    return false;
  }
}

var DB = null;

function seedFresh() {
  if (typeof global.BENCH_SEED !== 'function') {
    throw new Error('seed.js is not loaded: BENCH_SEED is undefined');
  }
  return global.BENCH_SEED();
}

function load() {
  if (DB) return DB;
  var persisted = readPersisted();
  if (persisted && persisted.__v === 1) { DB = persisted; return DB; }
  DB = seedFresh();
  DB.__v = 1;
  save();
  return DB;
}

function save() {
  if (!DB) return false;
  memoryStore = DB;
  return writePersisted(DB);
}

// The reset control. Drops the persisted copy and re-seeds from seed.js.
function reset() {
  var ls = rawStorage();
  if (ls) { try { ls.removeItem(STORE_KEY); } catch (e) { /* nothing to do */ } }
  DB = null; memoryStore = null;
  load();
  return true;
}

function storageState() {
  load();
  return { mode: storageMode, key: STORE_KEY, why: storageWhy };
}

// Rows handed out are copies. A caller that mutates what it got must not be able to
// reach into the store; every write goes through an RPC or it did not happen.
function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }

// ============================================================
// 3. SHARED COLUMN SETS  -  declared once, on purpose
// ============================================================
/*
  The audit found `lots` and `lab_reports` selected with DIFFERENT column lists in
  the console than in the queue: the console omitted edited_by and edited_at in both.
  Two copies of one projection, already drifted, and no checker covered it.

  Reconciled here on the wider list, and declared once. Every call site reads these
  constants; queue_checks.cjs asserts that both do, so the drift cannot come back.
*/
var LOT_COLS = ['id','lot_number','product','year','seq','lot_type','purpose','is_use_test',
                'lab_report_number','remarks','reserved_by','reserved_at','edited_by','edited_at',
                'd1','d2','d3','experiment_start','experiment_end','frozen'];

var LR_COLS  = ['id','lr_number','seq','year','product','revision','lr_type','subject',
                'report_date','created_by','created_at','edited_by','edited_at',
                'lr_display','standalone'];

// ============================================================
// 4. THE READ REGISTRY
// ============================================================
/*
  from   the object, base table or derived view
  cols   array of column names, or omitted for everything
  order  up to two [column, {ascending}] pairs
  eq     one [column, constant] pair. Exactly one read uses it.

  The seminar table is deliberately absent: that tab is removed, so nothing reads it.
  v_backlog is deliberately absent: only the read probe read it, and that is removed.
*/
var READS = {
  gridAll:        { from: 'v_grid' },
  gridAbsences:   { from: 'v_grid', cols: ['person_code','start_date','end_date','label'],
                    eq: ['category', 'absence'] },
  load:           { from: 'v_load' },
  scheduleItems:  { from: 'schedule_items' },
  itemOwners:     { from: 'item_owners' },
  training:       { from: 'training' },
  milestoneLeads: { from: 'milestones', cols: ['id','co_lead_code'] },
  holidayDates:   { from: 'public_holidays', cols: ['holiday_date','name'] },
  holidaysAll:    { from: 'public_holidays' },
  maintenance:    { from: 'instrument_maintenance' },
  dutyTypes:      { from: 'duty_types' },
  dutyAssigns:    { from: 'duty_assignments' },
  standingRoles:  { from: 'standing_roles' },
  taskStatuses:   { from: 'task_statuses' },
  absenceTypes:   { from: 'absence_types' },
  instruments:    { from: 'instruments' },
  productsAll:    { from: 'products' },
  productCodes:   { from: 'products',   cols: ['code','active'],  order: [['code']] },
  lotTypeValues:  { from: 'lot_types',  cols: ['value','active'], order: [['value']] },
  lrTypeValues:   { from: 'lr_types',   cols: ['value','active'], order: [['value']] },
  lotTypesAll:    { from: 'lot_types' },
  lrTypesAll:     { from: 'lr_types' },
  lots:           { from: 'lots',        cols: LOT_COLS, order: [['product'], ['seq']] },
  labReports:     { from: 'lab_reports', cols: LR_COLS,
                    order: [['lr_number', { ascending: false }]] }
};

// The two derived views. Base tables are returned as they are.
function objectRows(name) {
  var db = load();
  if (name === 'v_grid') return vGrid(db);
  if (name === 'v_load') return vLoad(db);
  return db[name] || [];
}

function vGrid(db) {
  var out = [];
  (db.milestones || []).forEach(function (m) {
    out.push({ id: 'ms' + m.id, category: 'milestone', person_code: m.co_lead_code,
               product: m.product, start_date: m.start_date, end_date: m.end_date,
               label: m.title });
  });
  (db.absences || []).forEach(function (a) {
    out.push({ id: 'ab' + a.id, category: 'absence', person_code: a.person_code,
               product: null, start_date: a.start_date, end_date: a.end_date,
               label: a.absence_type });
  });
  (db.instrument_bookings || []).forEach(function (b) {
    out.push({ id: 'ib' + b.id, category: 'instrument', person_code: b.person_code,
               product: null, start_date: b.start_date, end_date: b.end_date,
               label: b.instrument_code });
  });
  return out;
}

// Per person, per ISO week, the hours committed by schedule items they own.
/*
  v_load, REWRITTEN by the gate 3b port. The first cut emitted { person_code, day, hours } and
  the schedule page renders nothing from that: loadCells() filters on a `source` column, dedupes
  tasks by `id` against the visible set, sums a `share`, and builds its tooltip from a `label`.
  None of those four existed. The workload view drew its rows and left every cell blank, which
  reads as "nobody is committed to anything" rather than as a fault -- the reassuring answer,
  given confidently, from no data. The read inventory in the audit recorded that v_load exists;
  it did not record its column contract, and nothing downstream checked.

  SHARE IS NOT HOURS, and that is the substantive half of the correction. A day is split between
  the owners of the task, so a task with four owners costs each of them 0.25 of that day. It is
  a fraction of a person, never a count of hours, and effort_hours does not enter into it. The
  legend on the page states the same rule in the same words.

  Absences emit share 0.0 deliberately: they mark the day away without adding to the sum, which
  is what lets a person read as away AND loaded at once. Instrument bookings are emitted at a
  full day and dropped by the page, because the task running the instrument already carries the
  load and counting the booking too would double it -- the page decides that, not this view, and
  it decides it in one place.
*/
function vLoad(db) {
  var out = [];
  var owners = {};
  (db.item_owners || []).forEach(function (o) {
    (owners[o.item_id] = owners[o.item_id] || []).push(o.person_code);
  });
  (db.schedule_items || []).forEach(function (it) {
    if (!it.start_date || !it.end_date) return;
    var who = owners[it.id] || [];
    if (!who.length) return;
    var share = 1 / who.length;
    who.forEach(function (code) {
      var d = it.start_date;
      while (d <= it.end_date) {
        out.push({ source: 'task', id: it.id, person_code: code, day: d,
                   share: share, label: it.title });
        d = addDays(d, 1);
      }
    });
  });
  (db.absences || []).forEach(function (a) {
    var d = a.start_date;
    while (d && a.end_date && d <= a.end_date) {
      out.push({ source: 'absence', id: a.id, person_code: a.person_code, day: d,
                 share: 0, label: a.absence_type });
      d = addDays(d, 1);
    }
  });
  (db.instrument_bookings || []).forEach(function (b) {
    var d = b.start_date;
    while (d && b.end_date && d <= b.end_date) {
      out.push({ source: 'instrument', id: b.id, person_code: b.person_code, day: d,
                 share: 1, label: b.instrument_code });
      d = addDays(d, 1);
    }
  });
  return out;
}

function project(row, cols) {
  if (!cols) return clone(row);
  var out = {};
  for (var i = 0; i < cols.length; i++) out[cols[i]] = clone(row[cols[i]]);
  return out;
}

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

// The executor. Projection, up to two order keys, one constant equality. That is all.
function read(name) {
  var spec = READS[name];
  if (!spec) return { data: null, error: { message: 'unknown read: ' + name, code: 'BENCH_NO_READ' } };
  try {
    var rows = objectRows(spec.from).slice();
    if (spec.eq) {
      rows = rows.filter(function (r) { return r[spec.eq[0]] === spec.eq[1]; });
    }
    if (spec.order) {
      var keys = spec.order;
      rows.sort(function (x, y) {
        for (var i = 0; i < keys.length; i++) {
          var col = keys[i][0];
          var asc = !(keys[i][1] && keys[i][1].ascending === false);
          var c = cmp(x[col], y[col]);
          if (c) return asc ? c : -c;
        }
        return 0;
      });
    }
    return { data: rows.map(function (r) { return project(r, spec.cols); }), error: null };
  } catch (e) {
    return { data: null, error: { message: (e && e.message) || 'read failed', code: 'BENCH_READ' } };
  }
}

// ============================================================
// 5. DATE HELPERS  (arithmetic on ISO strings, no clock involved)
// ============================================================
function addDays(iso, n) {
  var p = String(iso).slice(0, 10).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));   // PARSING, not the clock
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 6. AUTH
// ============================================================
/*
  The login SCREEN is gone; the auth SURFACE is not. The four methods the original
  three files used are all still here, because the session is still a real thing:
  identity gates every write, and queue_checks.cjs asserts the shape.

  The bench opens already signed in. WHO it is signed in as is the "Viewing as" picker in
  each page header, and that choice is the stand-in for the login: it is persisted under
  its own key, through the same guarded storage as the dataset, so it is shared by all
  three pages and survives a reload. With nothing chosen, the queue and the schedule open
  as DEFAULT_USER and the console as the admin, which is what each page passes as its
  fallback. signInWithPassword still works and switches the session without persisting it.
*/
var DEFAULT_USER = 'IPB';
var session = null;
var authWatchers = [];

// ---- the picker's choice ----
// Its own key, not a field in the dataset: Reset data re-seeds the rows and must not
// quietly change who you are looking as. The memory copy is what a refused store falls
// back to, so the choice still holds for the session under file:// or in Node.
var VIEW_KEY = 'bench.viewAs';
var viewAsMemory = null;

function viewingAs() {
  var code = viewAsMemory;
  var ls = rawStorage();
  if (ls) { try { code = ls.getItem(VIEW_KEY) || code; } catch (e) { /* memory copy stands */ } }
  return (code && personByCode(code)) ? code : null;   // a code nobody holds is no choice at all
}
function setViewingAs(code) {
  viewAsMemory = code || null;
  var ls = rawStorage();
  if (!ls) return false;
  try {
    if (code) ls.setItem(VIEW_KEY, code); else ls.removeItem(VIEW_KEY);
    return true;
  } catch (e) { return false; }
}

function personByCode(code) {
  return (load().people || []).filter(function (p) { return p.code === code; })[0] || null;
}

function makeSession(code) {
  var p = personByCode(code);
  if (!p) return null;
  return { user: { id: 'bench-' + p.code, email: p.email, code: p.code } };
}

function emit() {
  var s = session;
  authWatchers.forEach(function (cb) {
    try { cb(s ? 'SIGNED_IN' : 'SIGNED_OUT', s); } catch (e) { /* a watcher must not break the rest */ }
  });
}

var auth = {
  onAuthStateChange: function (cb) {
    authWatchers.push(cb);
    // Fire once on subscribe, asynchronously, so a caller can finish wiring first.
    setTimeout(function () { try { cb(session ? 'SIGNED_IN' : 'SIGNED_OUT', session); } catch (e) {} }, 0);
    return { data: { subscription: { unsubscribe: function () {
      authWatchers = authWatchers.filter(function (w) { return w !== cb; });
    } } } };
  },
  signInWithPassword: function (creds) {
    var email = ((creds && creds.email) || '').toLowerCase();
    var p = (load().people || []).filter(function (x) {
      return String(x.email || '').toLowerCase() === email;
    })[0];
    if (!p) return Promise.resolve({ data: null, error: { message: 'Wrong email or password.' } });
    session = makeSession(p.code); emit();
    return Promise.resolve({ data: { session: session }, error: null });
  },
  signOut: function () { session = null; emit(); return Promise.resolve({ error: null }); },
  updateUser: function () {
    // No password store on the bench. Succeeds so the surface stays exercisable.
    return Promise.resolve({ data: { user: session && session.user }, error: null });
  }
};

// The picker's person if one is chosen, else the page's own fallback, else DEFAULT_USER.
function signInDefault(fallback) {
  session = makeSession(viewingAs() || fallback || DEFAULT_USER);
  emit();
  return session;
}

// ============================================================
// 7. RPCs
// ============================================================
/*
  79 of the 83 the audit inventoried. The four missing are the create, update, delete
  and lock RPCs for the seminar tab: that tab is removed, so they would be dead on
  arrival. Add them back the day the tab returns, not before.
*/
function err(message, code) { return { data: null, error: { message: message, code: code || 'BENCH' } }; }
function okay(data)         { return { data: data === undefined ? null : data, error: null }; }

function me() { return session ? personByCode(session.user.code) : null; }

function onRoster(p) {
  if (!p) return false;
  return !p.roster_until || p.roster_until >= today();
}

// The write gate, mirroring the server: posture 2 (inactive) reads everything and
// writes nothing, and a leaver is refused outright.
function requireWriter() {
  var p = me();
  if (!p) return 'You are not signed in.';
  if (!onRoster(p)) return 'You are no longer on the roster.';
  if (!p.active) return 'Your account cannot write. Ask an admin.';
  return null;
}
function requireAdmin() {
  var p = me();
  if (!p || !p.admin) return 'That is an admin action.';
  return null;
}

function nextId(list) {
  var n = 0;
  (list || []).forEach(function (r) { if (typeof r.id === 'number' && r.id > n) n = r.id; });
  return n + 1;
}
function byId(list, id) {
  var rows = load()[list] || [];
  for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i];
  return null;
}
function pad4(n) { return String(n).padStart(4, '0'); }
function stamp() { return now().toISOString(); }

// ---- generic list helpers, for the many small setup RPCs ----
function listAdd(table, row)        { var db = load(); db[table] = db[table] || []; db[table].push(row); save(); return okay(clone(row)); }
function listDel(table, pred)       { var db = load(); db[table] = (db[table] || []).filter(function (r) { return !pred(r); }); save(); return okay(true); }
function listSet(table, pred, patch){
  var db = load(); var hit = null;
  (db[table] || []).forEach(function (r) { if (pred(r)) { Object.assign(r, patch); hit = r; } });
  if (!hit) return err('No such row.', 'BENCH_404');
  save(); return okay(clone(hit));
}

// ---- bulk reorder, added by the gate 3a port ----
/*
  Three of the console's setup tables carry up/down arrows -- products, task statuses and
  instruments -- and each calls a *_order RPC with the WHOLE new key order in one argument.
  The audit's RPC inventory did not name them: it summarised that block as 'Setup via tdWrite'
  and listed the members it happened to enumerate, and these three were not among them. So they
  were missed when this file was built, and the arrows were dead on arrival in the port -- an
  unknown-RPC toast on every click. Found by admin_checks.cjs asserting its own whitelist
  against this file, which is the assertion gate 3a added for exactly this reason.

  BULK, NEVER PER-ROW, which is the property the page's own comment names: one call carries the
  entire order, so there is no window in which two rows share a sort_order or one is missing.
  Anything not named in the list keeps its place at the end, which is what makes a partial list
  safe rather than destructive.
*/
function reorder(table, key, list) {
  var g = requireAdmin(); if (g) return err(g);
  if (!Array.isArray(list) || !list.length) return err('No order given.');
  var db = load();
  var rows = db[table] || [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    if (seen[list[i]]) return err('That order names the same row twice.');
    seen[list[i]] = true;
    if (!rows.filter(function (r) { return r[key] === list[i]; })[0]) return err('No such row: ' + list[i]);
  }
  rows.forEach(function (r) {
    var at = list.indexOf(r[key]);
    if (at >= 0) r.sort_order = at + 1;
    else r.sort_order = list.length + 1;   // unnamed rows sink, keeping their relative order
  });
  save();
  return okay({ ordered: list.length });
}
var byValue = function (v) { return function (r) { return r.value === v; }; };
var byCode  = function (c) { return function (r) { return r.code  === c; }; };

var RPCS = {};

// ---- identity and roster (7) ----
// whoami and caller_is_admin carry BOTH terms, active and the date, as the originals do. That is
// what makes the queue refuse posture 2 and 5 outright (its door is whoami) while the schedule,
// whose door is the active-agnostic caller_roster_code, still lets them read. Before the picker
// nothing could sign in as an inactive person, so the missing active term here never showed.
RPCS.whoami = function () {
  var p = me();
  return okay(p && p.active && onRoster(p) ? [{ code: p.code, full_name: p.full_name, email: p.email, active: p.active }] : []);
};
RPCS.caller_code        = function () { var p = me(); return okay(p && p.active && onRoster(p) ? p.code : null); };
RPCS.caller_roster_code = function () { var p = me(); return okay(p && onRoster(p) ? p.code : null); };
RPCS.caller_is_admin    = function () { var p = me(); return okay(!!(p && p.admin && p.active && onRoster(p))); };
RPCS.caller_in_roster   = function () { return okay(onRoster(me())); };
RPCS.team_members       = function () {
  return okay((load().people || []).map(function (p) {
    return { code: p.code, full_name: p.full_name, active: p.active,
             roster_until: p.roster_until, mentor: p.mentor, email: p.email };
  }));
};
RPCS.roster_auth_status = function () {
  return okay((load().people || []).map(function (p) {
    return { code: p.code, has_login: p.has_login !== false, active: p.active,
             roster_until: p.roster_until };
  }));
};

// ---- roster writes (5) ----
RPCS.add_person = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  if (personByCode(a.p_code)) return err('That code is already in use.');
  return listAdd('people', { code: a.p_code, full_name: a.p_full_name, email: a.p_email,
                             active: true, admin: false, mentor: null, roster_until: null });
};
RPCS.remove_person = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  var held = (load().lots || []).filter(function (l) { return l.reserved_by === a.p_code; }).length
           + (load().lab_reports || []).filter(function (r) { return r.created_by === a.p_code; }).length;
  if (held) return err('That person still holds ' + held + ' register item(s). Offboard them first.');
  return listDel('people', byCode(a.p_code));
};
RPCS.set_person_active       = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('people', byCode(a.p_code), { active: !!a.p_active }); };
RPCS.set_person_mentor       = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('people', byCode(a.p_code), { mentor: a.p_mentor || null }); };
RPCS.set_person_roster_until = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('people', byCode(a.p_code), { roster_until: a.p_until || null }); };

// ---- products (3) ----
RPCS.add_product = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  var ex = (load().products || []).filter(byCode(a.p_code))[0];
  if (ex) return listSet('products', byCode(a.p_code), { active: true });
  return listAdd('products', { code: a.p_code, colour: null, active: true, sort_order: (load().products || []).length + 1 });
};
RPCS.retire_product    = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('products', byCode(a.p_code), { active: false }); };
RPCS.set_product_colour = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('products', byCode(a.p_code), { colour: a.p_colour || null }); };
RPCS.set_product_order  = function (a) { return reorder('products',      'code',  a.p_codes);  };

// ---- task statuses (7) ----
RPCS.add_task_status                = function (a) { var g = requireAdmin(); if (g) return err(g); return listAdd('task_statuses', { value: a.p_value, colour: null, texture: 'solid', is_terminal: false, cancelled: false, active: true, needs_start: false, sort_order: (load().task_statuses || []).length + 1 }); };
RPCS.delete_task_status             = function (a) { var g = requireAdmin(); if (g) return err(g); return listDel('task_statuses', byValue(a.p_value)); };
RPCS.set_task_status_order          = function (a) { return reorder('task_statuses', 'value', a.p_values); };
RPCS.set_task_status_texture        = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('task_statuses', byValue(a.p_value), { texture: a.p_texture }); };
RPCS.set_task_status_terminal       = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('task_statuses', byValue(a.p_value), { is_terminal: !!a.p_terminal }); };
RPCS.set_task_status_cancelled      = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('task_statuses', byValue(a.p_value), { cancelled: !!a.p_cancelled }); };
RPCS.set_task_status_active         = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('task_statuses', byValue(a.p_value), { active: !!a.p_active }); };
RPCS.set_task_status_needs_start    = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('task_statuses', byValue(a.p_value), { needs_start: !!a.p_needs_start }); };

// ---- absence types (4) ----
RPCS.add_absence_type        = function (a) { var g = requireAdmin(); if (g) return err(g); return listAdd('absence_types', { value: a.p_value, code: null, active: true }); };
RPCS.delete_absence_type     = function (a) { var g = requireAdmin(); if (g) return err(g); return listDel('absence_types', byValue(a.p_value)); };
RPCS.set_absence_type_active = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('absence_types', byValue(a.p_value), { active: !!a.p_active }); };
RPCS.set_absence_type_code   = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('absence_types', byValue(a.p_value), { code: a.p_code || null }); };

// ---- instruments (7) ----
RPCS.add_instrument          = function (a) { var g = requireAdmin(); if (g) return err(g); return listAdd('instruments', { code: a.p_code, name: a.p_name || a.p_code, active: true, bookable: true, owner_main: null, owner_backup: null }); };
RPCS.update_instrument       = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('instruments', byCode(a.p_code), { name: a.p_name }); };
RPCS.delete_instrument       = function (a) { var g = requireAdmin(); if (g) return err(g); return listDel('instruments', byCode(a.p_code)); };
RPCS.set_instrument_active   = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('instruments', byCode(a.p_code), { active: !!a.p_active }); };
RPCS.set_instrument_bookable = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('instruments', byCode(a.p_code), { bookable: !!a.p_bookable }); };
RPCS.set_instrument_owners   = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('instruments', byCode(a.p_code), { owner_main: a.p_main || null, owner_backup: a.p_backup || null }); };
RPCS.set_instrument_order    = function (a) { return reorder('instruments', 'code', a.p_codes); };
RPCS.rename_instrument_code  = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  if ((load().instruments || []).filter(byCode(a.p_new))[0]) return err('That code is already in use.');
  var r = listSet('instruments', byCode(a.p_old), { code: a.p_new });
  if (r.error) return r;
  (load().instrument_bookings || []).forEach(function (b) { if (b.instrument_code === a.p_old) b.instrument_code = a.p_new; });
  (load().instrument_maintenance || []).forEach(function (m) { if (m.instrument_code === a.p_old) m.instrument_code = a.p_new; });
  save(); return r;
};

// ---- standing roles (4) ----
RPCS.add_standing_role        = function (a) { var g = requireAdmin(); if (g) return err(g); return listAdd('standing_roles', { code: a.p_code, name: a.p_name, main: null, backup: null, active: true, sort_order: (load().standing_roles || []).length * 10 + 10 }); };
RPCS.update_standing_role     = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('standing_roles', byCode(a.p_code), { name: a.p_name }); };
RPCS.set_standing_role_active = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('standing_roles', byCode(a.p_code), { active: !!a.p_active }); };
RPCS.set_standing_role_owners = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('standing_roles', byCode(a.p_code), { main: a.p_main || null, backup: a.p_backup || null }); };

// ---- public holidays (2) ----
RPCS.set_public_holiday    = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  var ex = (load().public_holidays || []).filter(function (h) { return h.holiday_date === a.p_date; })[0];
  if (ex) return listSet('public_holidays', function (h) { return h.holiday_date === a.p_date; }, { name: a.p_name });
  return listAdd('public_holidays', { holiday_date: a.p_date, name: a.p_name });
};
RPCS.delete_public_holiday = function (a) { var g = requireAdmin(); if (g) return err(g); return listDel('public_holidays', function (h) { return h.holiday_date === a.p_date; }); };

// ---- duty types and assignments (9) ----
RPCS.add_duty_type       = function (a) { var g = requireAdmin(); if (g) return err(g); return listAdd('duty_types', { code: a.p_code, name: a.p_name, colour: a.p_colour || null, show_final_days: a.p_show_final_days || null, active: true }); };
RPCS.update_duty_type    = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('duty_types', byCode(a.p_code), { name: a.p_name, colour: a.p_colour || null, show_final_days: a.p_show_final_days || null }); };
RPCS.set_duty_type_active = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('duty_types', byCode(a.p_code), { active: !!a.p_active }); };
RPCS.create_duty_assignment = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  return listAdd('duty_assignments', { id: nextId(load().duty_assignments), duty_type: a.p_type,
    person: a.p_person, start_date: a.p_from, end_date: a.p_to, note: a.p_note || null });
};
RPCS.delete_duty_assignment     = function (a) { var g = requireAdmin(); if (g) return err(g); return listDel('duty_assignments', function (r) { return String(r.id) === String(a.p_id); }); };
RPCS.set_duty_assignment_person = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('duty_assignments', function (r) { return String(r.id) === String(a.p_id); }, { person: a.p_person }); };
RPCS.set_duty_assignment_note   = function (a) { var g = requireAdmin(); if (g) return err(g); return listSet('duty_assignments', function (r) { return String(r.id) === String(a.p_id); }, { note: a.p_note || null }); };
RPCS.delete_duty_assignments    = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  var db = load(), before = (db.duty_assignments || []).length;
  db.duty_assignments = (db.duty_assignments || []).filter(function (r) {
    return !(r.duty_type === a.p_type && r.start_date >= a.p_from && r.start_date <= a.p_to);
  });
  save(); return okay({ removed: before - db.duty_assignments.length });
};
RPCS.import_duty_assignments = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  var lines = String(a.p_tsv || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  var rows = lines.map(function (l) { var c = l.split('\t'); return { start_date: c[0], person: c[1], note: c[2] || null }; });
  var bad = rows.filter(function (r) { return !/^\d{4}-\d{2}-\d{2}$/.test(r.start_date || ''); });
  if (bad.length) return err(bad.length + ' row(s) have an unreadable date.');
  if (a.p_dry_run) return okay({ parsed: rows.length, applied: 0 });
  var db = load();
  rows.forEach(function (r) {
    db.duty_assignments.push({ id: nextId(db.duty_assignments), duty_type: a.p_type,
      person: r.person, start_date: r.start_date, end_date: addDays(r.start_date, 6), note: r.note });
  });
  save(); return okay({ parsed: rows.length, applied: rows.length });
};

// ---- schedule items, milestones and the janitor tables (16) ----
function makeCrud(table, extra) {
  return {
    create: function (a) {
      var g = requireWriter(); if (g) return err(g);
      var row = Object.assign({ id: nextId(load()[table]) }, strip(a));
      if (extra) extra(row, a);
      return listAdd(table, row);
    },
    update: function (a) {
      var g = requireWriter(); if (g) return err(g);
      return listSet(table, function (r) { return String(r.id) === String(a.p_id); }, strip(a));
    },
    remove: function (a) {
      var g = requireWriter(); if (g) return err(g);
      return listDel(table, function (r) { return String(r.id) === String(a.p_id); });
    }
  };
}
// p_foo -> foo, dropping p_id which is the key rather than a column.
function strip(a) {
  var out = {};
  Object.keys(a || {}).forEach(function (k) {
    if (k === 'p_id' || k === 'p_owners') return;
    if (k.indexOf('p_') === 0) out[k.slice(2)] = a[k];
  });
  return out;
}

/*
  THE START GATE, assert_start_ok's equivalent. A status whose needs_start flag is set asserts
  that work has begun, so it cannot sit on a task with no start date or one whose start date has
  not arrived. KEYED TO THE FLAG, never to a status name: which statuses it applies to is a tick
  in the console, so renaming a status cannot switch the rule off. The schedule page mirrors this
  in startOk() so the refusal reads as a sentence; this is the part that actually refuses.
*/
function assertStartOk(status, startDate) {
  var s = (load().task_statuses || []).filter(function (x) { return x.value === status; })[0];
  if (!s || !s.needs_start) return null;
  if (!startDate) return status + ' means work has begun, so the task needs a start date.';
  if (String(startDate).slice(0, 10) > today()) return status + ' means work has begun, and this task does not start until ' + String(startDate).slice(0, 10) + '.';
  return null;
}

var si = makeCrud('schedule_items');
RPCS.create_schedule_item = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var st = assertStartOk(a.p_status, a.p_start_date); if (st) return err(st, 'BENCH_START');
  var r = si.create(a);
  if (!r.error && a.p_owners) setOwners(r.data.id, a.p_owners);
  return r;
};
// The page sends the whole row, but a missing key is read off the stored row rather than taken
// as empty, so a partial caller cannot slip a flagged status past the gate by omitting a date.
RPCS.update_schedule_item = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var row = byId('schedule_items', a.p_id);
  if (!row) return err('No such schedule item.', 'BENCH_404');
  var status = ('p_status' in a) ? a.p_status : row.status;
  var start  = ('p_start_date' in a) ? a.p_start_date : row.start_date;
  var st = assertStartOk(status, start); if (st) return err(st, 'BENCH_START');
  return si.update(a);
};
RPCS.delete_schedule_item = function (a) {
  var r = si.remove(a);
  if (!r.error) { var db = load(); db.item_owners = (db.item_owners || []).filter(function (o) { return String(o.item_id) !== String(a.p_id); }); save(); }
  return r;
};
function setOwners(itemId, owners) {
  var db = load();
  db.item_owners = (db.item_owners || []).filter(function (o) { return String(o.item_id) !== String(itemId); });
  (owners || []).forEach(function (c) { db.item_owners.push({ item_id: itemId, person_code: c }); });
  save();
}
RPCS.set_item_owners = function (a) {
  var g = requireWriter(); if (g) return err(g);
  if (!byId('schedule_items', a.p_item_id)) return err('No such schedule item.', 'BENCH_404');
  setOwners(a.p_item_id, a.p_owners);
  return okay(true);
};

var ms = makeCrud('milestones');
RPCS.create_milestone = ms.create; RPCS.update_milestone = ms.update; RPCS.delete_milestone = ms.remove;

/*
  ABSENCES ARE THE ONE WRITE POSTURE 2 HAS, and only their own. The gate is the roster, not the
  active flag: an inactive person who is still on the roster may create, change and delete an
  absence whose person is themselves, and nothing else anywhere. The admin may write anybody's.
  Everybody else, posture 1 included, is held to their own, which is the ownership half the
  schedule page mirrors in clkFor. Checked against the stored row as well as the new one, so an
  update cannot move somebody else's absence onto yourself or yours onto somebody else.
*/
function requireAbsenceWriter(personCode, existing) {
  var p = me();
  if (!p) return 'You are not signed in.';
  if (!onRoster(p)) return 'You are no longer on the roster.';
  if (p.admin && p.active) return null;
  var mine = function (c) { return c === p.code; };
  if (existing && !mine(existing.person_code)) return 'You can only change your own absences.';
  if (personCode !== undefined && !mine(personCode)) return 'You can only record your own absences.';
  return null;
}
RPCS.create_absence = function (a) {
  var g = requireAbsenceWriter(a.p_person_code); if (g) return err(g);
  return listAdd('absences', Object.assign({ id: nextId(load().absences) }, strip(a)));
};
RPCS.update_absence = function (a) {
  var row = byId('absences', a.p_id);
  if (!row) return err('No such absence.', 'BENCH_404');
  var g = requireAbsenceWriter(a.p_person_code, row); if (g) return err(g);
  return listSet('absences', function (r) { return String(r.id) === String(a.p_id); }, strip(a));
};
RPCS.delete_absence = function (a) {
  var row = byId('absences', a.p_id);
  if (!row) return err('No such absence.', 'BENCH_404');
  var g = requireAbsenceWriter(undefined, row); if (g) return err(g);
  return listDel('absences', function (r) { return String(r.id) === String(a.p_id); });
};

var tr = makeCrud('training');
RPCS.create_training = tr.create; RPCS.update_training = tr.update; RPCS.delete_training = tr.remove;

var mt = makeCrud('instrument_maintenance');
RPCS.create_maintenance = mt.create; RPCS.update_maintenance = mt.update; RPCS.delete_maintenance = mt.remove;

var ibk = makeCrud('instrument_bookings');
RPCS.create_instrument_booking = ibk.create;
RPCS.update_instrument_booking = ibk.update;
RPCS.delete_instrument_booking = ibk.remove;

// ---- the register: lots and lab reports (9) ----
/*
  THE NUMBER RULE, and it is the one thing users notice: you get the LOWEST FREE
  number for that product and year, and a released number stays free for reuse while
  a skipped one stays skipped. Nothing renumbers.
*/
function nextSeq(rows, match) {
  var used = {};
  rows.filter(match).forEach(function (r) { used[r.seq] = true; });
  var n = 1; while (used[n]) n++;
  return n;
}

RPCS.reserve_lot = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var p = me(), db = load(), y = year2();
  if (!a.p_product) return err('Pick a product.');
  var seq = nextSeq(db.lots, function (l) { return l.product === a.p_product && l.year === y; });
  var row = { id: nextId(db.lots), product: a.p_product, year: y, seq: seq,
              lot_number: a.p_product + '-' + y + '-' + pad4(seq),
              lot_type: a.p_lot_type, purpose: a.p_purpose || null,
              is_use_test: !!a.p_is_use_test, lab_report_number: null, remarks: null,
              reserved_by: p.code, reserved_at: stamp(), edited_by: null, edited_at: null,
              d1: null, d2: null, d3: null, experiment_start: null, experiment_end: null,
              frozen: false };
  return listAdd('lots', row);
};

RPCS.reserve_lr = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var p = me(), db = load(), y = year2();
  if (!a.p_product) return err('Pick a product.');
  var seq = nextSeq(db.lab_reports, function (r) { return r.year === y; });
  var row = { id: nextId(db.lab_reports), lr_number: 'LR-' + y + '-' + pad4(seq), seq: seq, year: y,
              product: a.p_product, revision: 1, lr_type: a.p_lr_type, subject: a.p_subject || null,
              report_date: null, created_by: p.code, created_at: stamp(),
              edited_by: null, edited_at: null, lr_display: '', standalone: !!a.p_standalone };
  return listAdd('lab_reports', row);
};

// Reserve straight off a schedule item. Same numbers, different entry point.
RPCS.reserve_lot_for_item = function (a) {
  var it = byId('schedule_items', a.p_item_id);
  if (!it) return err('No such schedule item.', 'BENCH_404');
  return RPCS.reserve_lot({ p_product: it.product, p_lot_type: a.p_lot_type,
                            p_purpose: a.p_purpose, p_is_use_test: a.p_is_use_test });
};
RPCS.reserve_lr_for_item = function (a) {
  var it = byId('schedule_items', a.p_item_id);
  if (!it) return err('No such schedule item.', 'BENCH_404');
  return RPCS.reserve_lr({ p_product: it.product, p_lr_type: a.p_lr_type,
                           p_subject: a.p_subject, p_standalone: a.p_standalone });
};

function lotIsLocked(l) {
  return !!l.frozen
      || (l.is_use_test && !!l.d2)
      || (!l.is_use_test && !!l.lab_report_number)
      || (!l.is_use_test && !!l.experiment_end);
}

RPCS.update_lot = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var p = me(), lot = byId('lots', a.p_id);
  if (!lot) return err('No such lot.', 'BENCH_404');
  if (lot.reserved_by !== p.code && !p.admin) return err('That lot belongs to somebody else.');
  var wasLocked = lotIsLocked(lot);
  /*
    THE BRANCHED UPDATE, as the original's was. Frozen refuses everyone, the admin included.
    Any other locked lot is open to the admin, which is the console's full-edit (clearing a
    mistaken experiment end to reopen a lot, correcting any field), and every such edit writes
    an admin_edit_log row keyed on lot_number. For everyone else the only way into a locked lot
    is the QC escape: a use-test lot may still take its d3.
  */
  var adminLockEdit = false;
  if (wasLocked) {
    if (lot.frozen) return err('That lot is frozen and cannot be edited.');
    if (p.admin) adminLockEdit = true;
    else if (!(lot.is_use_test && lot.d2 && !lot.d3)) return err('That lot is locked.');
  }

  // The LR reference rules, mirrored from the server: must exist, must match the
  // product, and must still be open. Only when the link CHANGES: re-saving a lot that is
  // already on a signed report is not that report taking a new lot.
  if (a.p_lab_report_number && a.p_lab_report_number !== lot.lab_report_number) {
    var lr = (load().lab_reports || []).filter(function (r) { return r.lr_number === a.p_lab_report_number; })[0];
    if (!lr) return err('LR ' + a.p_lab_report_number + ' is not in the register.');
    if (lr.product !== lot.product) return err('LR ' + lr.lr_number + ' is for ' + lr.product + ', not ' + lot.product + '.');
    if (lr.report_date) return err('LR ' + lr.lr_number + ' is signed and cannot take new lots.');
  }
  var patch = strip(a);
  delete patch.owner;
  if (a.p_owner) patch.reserved_by = a.p_owner;
  patch.edited_by = p.code; patch.edited_at = stamp();
  var before = clone(lot);
  var res = listSet('lots', function (r) { return String(r.id) === String(a.p_id); }, patch);
  if (!res.error && adminLockEdit) {
    // Keyed on lot_number only, like the original table. before/after are this build's choice
    // of payload: the reference records the key and the editor, not the other columns.
    var db = load();
    db.admin_edit_log = db.admin_edit_log || [];
    db.admin_edit_log.push({ id: nextId(db.admin_edit_log), lot_number: lot.lot_number,
                             edited_by: p.code, edited_at: patch.edited_at,
                             before: before, after: clone(res.data) });
    save();
  }
  return res;
};

RPCS.update_lr = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var p = me(), lr = byId('lab_reports', a.p_id);
  if (!lr) return err('No such lab report.', 'BENCH_404');
  if (lr.created_by !== p.code && !p.admin) return err('That report belongs to somebody else.');
  if (lr.report_date) return err('That report is signed.');
  // The two-way sign gate.
  if (a.p_report_date) {
    var linked = (load().lots || []).filter(function (l) { return l.lab_report_number === lr.lr_number; }).length;
    var standalone = (a.p_standalone === undefined) ? lr.standalone : !!a.p_standalone;
    if (!standalone && linked === 0) return err('A non-standalone report needs at least one lot before it can be signed.');
    if (standalone && linked > 0)    return err('A standalone report cannot be signed with ' + linked + ' lot(s) linked.');
  }
  var patch = strip(a);
  if (a.p_created_by) patch.created_by = a.p_created_by;
  patch.edited_by = p.code; patch.edited_at = stamp();
  return listSet('lab_reports', function (r) { return String(r.id) === String(a.p_id); }, patch);
};

// Bump in place, archive the prior revision. The number is kept.
RPCS.revise_lr = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var p = me(), db = load(), lr = byId('lab_reports', a.p_id);
  if (!lr) return err('No such lab report.', 'BENCH_404');
  if (!lr.report_date) return err('That report is already open.');
  db.lr_archive = db.lr_archive || [];
  db.lr_archive.push(clone(lr));
  lr.revision += 1;
  lr.lr_display = ' R' + String(lr.revision).padStart(2, '0');
  lr.report_date = null;
  lr.created_by = a.p_new_owner || lr.created_by;
  lr.edited_by = p.code; lr.edited_at = stamp();
  save();
  return okay([clone(lr)]);
};

RPCS.release_lot = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var p = me(), lot = byId('lots', a.p_id);
  if (!lot) return err('No such lot.', 'BENCH_404');
  if (lot.reserved_by !== p.code && !p.admin) return err('That lot belongs to somebody else.');
  if (lotIsLocked(lot)) return err('That lot is locked and cannot be released.');
  return listDel('lots', function (r) { return String(r.id) === String(a.p_id); });
};

/*
  RELEASE ON A REVISED LR UNDOES THE REVISION, it does not delete the number. v0.19
  shipped after the old path dissolved a whole LR number, signed prior revision and
  all. revision > 1 restores the highest archived revision onto the live row and
  drops that archive row; revision 1 is the real delete.
*/
RPCS.release_lr = function (a) {
  var g = requireWriter(); if (g) return err(g);
  var p = me(), db = load(), lr = byId('lab_reports', a.p_id);
  if (!lr) return err('No such lab report.', 'BENCH_404');
  if (lr.created_by !== p.code && !p.admin) return err('That report belongs to somebody else.');
  if (lr.report_date) return err('That report is signed.');

  if (lr.revision > 1) {
    var mine = (db.lr_archive || []).filter(function (r) { return r.lr_number === lr.lr_number; });
    if (!mine.length) return err('No archived revision to restore.');
    mine.sort(function (x, y) { return y.revision - x.revision; });
    var prior = mine[0];
    Object.assign(lr, clone(prior));
    db.lr_archive = db.lr_archive.filter(function (r) { return r !== prior; });
    save();
    return okay([clone(lr)]);
  }
  var linked = (db.lots || []).filter(function (l) { return l.lab_report_number === lr.lr_number; });
  if (linked.length) return err('LR ' + lr.lr_number + ' still has ' + linked.length + ' lot(s) linked.');
  return listDel('lab_reports', function (r) { return String(r.id) === String(a.p_id); });
};

// ---- offboarding (3) ----
function openItemsFor(code) {
  var db = load(), out = [];
  (db.lots || []).forEach(function (l) { if (l.reserved_by === code && !lotIsLocked(l)) out.push({ surface: 'lot', target_id: l.id, number: l.lot_number }); });
  (db.lab_reports || []).forEach(function (r) { if (r.created_by === code && !r.report_date) out.push({ surface: 'lr', target_id: r.id, number: r.lr_number }); });
  return out;
}
RPCS.offboard_inventory = function (a) { var g = requireAdmin(); if (g) return err(g); return okay(openItemsFor(a.p_code)); };
RPCS.offboard_validate  = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  var open = openItemsFor(a.p_code), plan = a.p_plan || [];
  var planned = {}; plan.forEach(function (p) { planned[p.surface + '|' + p.target_id] = p; });
  var missing = open.filter(function (o) { return !planned[o.surface + '|' + o.target_id]; });
  return okay({ open: open.length, planned: plan.length, missing: missing });
};
RPCS.offboard_apply = function (a) {
  var g = requireAdmin(); if (g) return err(g);
  var v = RPCS.offboard_validate(a);
  if (v.error) return v;
  if (v.data.missing.length) return err(v.data.missing.length + ' open item(s) have no plan.');
  if (a.p_dry_run) return okay({ applied: 0, would: (a.p_plan || []).length });
  var db = load(), n = 0;
  (a.p_plan || []).forEach(function (p) {
    if (p.action === 'release') {
      if (p.surface === 'lot') db.lots = db.lots.filter(function (l) { return String(l.id) !== String(p.target_id); });
      else db.lab_reports = db.lab_reports.filter(function (r) { return String(r.id) !== String(p.target_id); });
    } else {
      if (p.surface === 'lot') { var l = byId('lots', p.target_id); if (l) l.reserved_by = p.to; }
      else { var r = byId('lab_reports', p.target_id); if (r) r.created_by = p.to; }
    }
    n++;
  });
  var per = personByCode(a.p_code);
  if (per) per.roster_until = today();
  save();
  return okay({ applied: n });
};

function rpc(name, args) {
  var fn = RPCS[name];
  if (!fn) return Promise.resolve(err('unknown RPC: ' + name, 'BENCH_NO_RPC'));
  try { return Promise.resolve(fn(args || {})); }
  catch (e) { return Promise.resolve(err((e && e.message) || 'RPC failed', 'BENCH_RPC')); }
}

// read() is synchronous underneath but every caller awaits it, so hand back a promise.
function readAsync(name) { return Promise.resolve(read(name)); }

// ============================================================
// 8. EXPORT
// ============================================================
global.core = {
  now: now, nowMs: nowMs, today: today, year2: year2,
  read: readAsync, readSync: read, READS: READS,
  rpc: rpc, RPCS: RPCS,
  auth: auth, signInDefault: signInDefault, DEFAULT_USER: DEFAULT_USER,
  viewingAs: viewingAs, setViewingAs: setViewingAs, VIEW_KEY: VIEW_KEY,
  reset: reset, storageState: storageState, STORE_KEY: STORE_KEY,
  LOT_COLS: LOT_COLS, LR_COLS: LR_COLS,
  ADMIN_CODE: 'HZO',
  db: function () { return load(); }
};

})(typeof window !== 'undefined' ? window : globalThis);
