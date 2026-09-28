#!/usr/bin/env node
/*
  sched_checks.cjs  -  run against the built file:  node sched_checks.cjs sched.html

  Every check here exists because of a defect that shipped. All of them share a shape: the JS
  parsed, the markup was correct, the handlers worked, and the screen was still wrong. Node has
  no layout and no stylesheet, so that whole class is invisible to a render test. These close the
  part of it that can be read off the source.

  What they cannot see: font weight, spacing, whether a thing is ugly, and whether the tool
  answers the question. That is what screenshots are for.
*/
const fs = require('fs');
const path = process.argv[2] || 'sched.html';
const src = fs.readFileSync(path, 'utf8');
// COMMENTS ARE PROSE, and this line did not know it. src.match(/<style>/) finds the FIRST one,
// which is the header comment's own sentence about the lifted <style> block, so `css` has been
// carrying ~700 lines of English and every class NAMED in that prose counted as defined. CLASSES
// has had a false-negative hole this whole time: mention .foo in a change-history entry and .foo
// needs no rule. Fourth instance of this exact defect. Strip first, then extract.
const bare = src.replace(/<!--[\s\S]*?-->/g, '');
const css = bare.match(/<style>([\s\S]*?)<\/style>/)[1];
const cssNoComment = css.replace(/\/\*[\s\S]*?\*\//g, '');
const js  = src.match(/<script>\n([\s\S]*?)\n<\/script>\s*<\/body>/)[1];
let fails = 0;
const ok   = m => console.log('  PASS  ' + m);
const bad  = m => { fails++; console.log('  FAIL  ' + m); };

// ---------------------------------------------------------------- 1. assembly
// Two builds running put an entire script block past the closing html tag, because the
// concatenation was done by hand. Comments are prose: strip them before counting tags.
console.log('\nASSEMBLY');
{
  const bare = src.replace(/<!--[\s\S]*?-->/g, '');
  const c = t => bare.split(t).length - 1;
  c('</html>') === 1 ? ok('html closed once') : bad('html closed ' + c('</html>') + ' times');
  c('</body>') === 1 ? ok('body closed once') : bad('body closed ' + c('</body>') + ' times');
  c('</script>') === 3 ? ok('script closed three times (seed, core, inline)') : bad('script closed ' + c('</script>') + ' times');
  try { new Function(js); ok('inline script parses (' + js.split('\n').length + ' lines)'); }
  catch (e) { bad('inline script: ' + e.message); }
}

// ---------------------------------------------------------------- 2. handlers
// jsq() emits a JS string literal INSIDE a double-quoted HTML attribute. Two escaping layers.
// A value carrying a quote of either kind must survive both.
console.log('\nHANDLERS');
{
  // Comments are prose, same as in ASSEMBLY above, and this section never stripped them. It
  // went unnoticed until a v0.9 comment quoted onmousemove="colHovr(event)" as an EXAMPLE of a
  // typo and this check reported it as a broken handler. A false positive is its own defect:
  // a checker that cries wolf stops being read, which is how the real one gets waved through.
  // Measure the markup, not the prose about the markup.
  const html = src.replace(/<!--[\s\S]*?-->/g, '');
  // Two layers of unescaping, and they are different layers. Handlers reach the browser via a
  // JS string literal that emits an HTML attribute, so the raw file holds JS-source escapes
  // (\' for a quote) around HTML entities (&#39; from jsq). Undo the source escape, then the
  // entity, then parse. Handlers built by concatenation cannot be resolved statically at all
  // and are counted separately rather than reported as broken.
  const unsrc = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  const dec   = s => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"')
                      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // mousemove/mouseleave added v0.9: the column-hover handlers were outside this net, so a
  // typo'd target would have been silently dead. scroll added v0.12, THIRD time this has been
  // needed: onscroll="pinScroll()" freezes the horizontal while an editor is open, and a typo
  // in it would have been silently dead in exactly the same way. Same defect class, same fix,
  // tightening an existing check rather than adding a speculative one.
  const hs = [...html.matchAll(/on(?:click|change|input|keydown|mousemove|mouseleave|scroll)="([^"]*)"/g)].map(m => m[1]);
  let broken = 0, dynamic = 0;
  for (const h of hs) {
    if (/'\s*\+|\+\s*'/.test(h)) { dynamic++; continue; }   // built at render time
    try { new Function('event', 'this_', dec(unsrc(h)).replace(/\bthis\b/g, 'this_')); }
    catch (e) { broken++; console.log('        BROKEN: ' + dec(unsrc(h))); }
  }
  broken ? bad(broken + ' of ' + hs.length + ' handlers do not parse')
         : ok((hs.length - dynamic) + ' static handlers parse; ' + dynamic + ' built at render time, not checkable here');

  const refs = [...new Set([...html.matchAll(/on(?:click|change|input|keydown|mousemove|mouseleave|scroll)="([a-zA-Z0-9_]+)\(/g)].map(m => m[1]))];
  const defs = new Set([...js.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(/g)].map(m => m[1]));
  const miss = refs.filter(r => !defs.has(r) && r !== 'if' && r !== 'event');
  miss.length ? bad('handler targets with no function: ' + miss.join(', ')) : ok('every handler target is defined');

  const ids = [...new Set([...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))];
  const mi  = ids.filter(i => !src.includes('id="' + i + '"'));
  // ids created by render functions are not in the static markup; only flag the shell's
  const shell = mi.filter(i => ['app','loginScreen','offroster','toast','modalBody','modalOverlay',
                               'identity','email','password','stagingBanner'].includes(i));
  shell.length ? bad('shell ids missing from markup: ' + shell.join(', ')) : ok('every shell element id exists');
}

// ---------------------------------------------------------------- 3. sticky
// v0.3 shipped .cat and .grp with position:sticky AND min-width:100%. A sticky element wider
// than its scrollport never sticks, so all four category headers rode off the left edge of a
// grid that opens scrolled to today. No node-side render test can see this: it is layout.
console.log('\nSTICKY');
{
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  let n = 0, b = 0;
  for (const [, sel, body] of rules) {
    if (!/position:\s*sticky/.test(body)) continue;
    n++;
    if (/min-width:\s*100%|(^|;)\s*width:\s*100%/.test(body)) { b++; console.log('        ' + sel.trim()); }
  }
  b ? bad(b + ' of ' + n + ' sticky rules are wider than their scrollport')
    : ok(n + ' sticky rules, none full-width');
  for (const [inner, outer] of [['cat', 'catband'], ['grp', 'grpband'], ['emptycat', 'emptyband']]) {
    new RegExp('class="' + outer + '"[^>]*><div class="' + inner + '"').test(src)
      ? ok('.' + inner + ' sits inside .' + outer)
      : bad('.' + inner + ' is not wrapped in .' + outer + ' — it will scroll away');
  }
}

// ---------------------------------------------------------------- 4. classes
// v0.4 shipped a stale css.html: the whole inline editor rendered as browser defaults. The JS
// parsed, the markup was right, every handler worked. Only a screen showed it.
console.log('\nCLASSES');
{
  const used = new Set();
  for (const m of src.matchAll(/class="([^"'{}+]+)"/g)) m[1].trim().split(/\s+/).forEach(c => c && used.add(c));
  for (const m of src.matchAll(/class="([^"]*?)'\s*\+/g)) m[1].trim().split(/\s+/).forEach(c => c && used.add(c));
  const def = new Set();
  for (const m of css.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)) def.add(m[1]);
  const IGN = new Set(['data','active','error','ok','primary','danger','tick','mid','code','wrap',
                       'board','dcol','lrref']);
  const miss = [...used].filter(c => {
    if (IGN.has(c) || def.has(c)) return false;
    if (c.endsWith('-')) return ![...def].some(d => d.startsWith(c));   // concatenated prefix
    return true;
  }).sort();
  miss.length ? bad('emitted with no CSS rule: ' + miss.join(', '))
              : ok(used.size + ' emitted classes, all have rules');
}

// ---------------------------------------------------------------- 5. contrast
// .gday.we used --border: 1.5:1 light, 1.3:1 dark. Not faint, absent. Then this checker was
// found to match only the FIRST :root block, so it measured the lifted palette and ignored every
// grid var while a 1.00:1 defect sat next to it. Merge all blocks.
console.log('\nCONTRAST');
{
  const vars = { light: {}, dark: {} }, decls = { light: '', dark: '' };
  for (const m of css.matchAll(/:root,\s*\[data-theme="light"\]\s*\{([^}]*)\}/g)) decls.light += m[1];
  for (const m of css.matchAll(/\[data-theme="dark"\]\s*\{([^}]*)\}/g))            decls.dark  += m[1];
  for (const t of ['light', 'dark'])
    for (const d of decls[t].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|rgba\([^)]*\))/g)) vars[t][d[1]] = d[2];

  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = h => { const n = parseInt(h.slice(1), 16);
    return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  const PAIRS = [
    ['month band',     /\.gmon\{([^}]*)\}/,      'bg2'],
    ['weekday number', /\.gday\{([^}]*)\}/,      'bg2'],
    ['weekend number', /\.gday\.we\{([^}]*)\}/,  'bg2'],
    ['row code',       /\.rh \.rh-sub\{([^}]*)\}/, 'card'],
    ['category',       /\.cat-t\{([^}]*)\}/,     'bg2'],
    ['empty prompt',   /\.emptycat\{([^}]*)\}/,  'card'],
    // v0.35.0. Both dashboard alert titles, and the PULSE TROUGH as a third pair. The animation
    // paints a colour that appears in no rule body, only in a keyframe stop, so without this line
    // half of every cycle is invisible to the harness. Extracted from the 50% stop rather than
    // hardcoded, so retuning the keyframe cannot quietly drop the check.
    // v0.36.0. The Standing panels drop to --text2 for the label column and the whole point is that
    // it stays READABLE while receding. Asserted rather than eyeballed: this is exactly the change
    // that gets pushed a shade too far the next time somebody thinks it still looks busy.
    ['standing label',  /\.st-role\{([^}]*)\}/,  'card'],
    ['overdue title',  /\.db-late \.db-gt\{([^}]*)\}/, 'card'],
    ['slip title',     /\.db-slip \.db-gt\{([^}]*)\}/, 'card'],
    ['slip pulse mid', /@keyframes db-pulse\{[^}]*\}\s*50%\{([^}]*)\}/, 'card'],
  ];
  let worst = 99;
  console.log('        element          var        light    dark');
  for (const [label, re, bgv] of PAIRS) {
    const m = css.match(re), c = m && m[1].match(/color:var\(--([a-z0-9-]+)\)/);
    if (!c) continue;
    const out = ['light', 'dark'].map(t => { const r = ratio(vars[t][c[1]], vars[t][bgv]);
      worst = Math.min(worst, r); return (r.toFixed(1) + ':1').padEnd(9); });
    console.log('        ' + label.padEnd(17) + ('--' + c[1]).padEnd(11) + out.join(''));
  }
  worst >= 3 ? ok('worst text pair ' + worst.toFixed(1) + ':1') : bad('text under 3:1');

  // Graphical. The text pass missed the worst defect in the file, because .wk used --bg2 over
  // --card, which in light is #ffffff on #ffffff. 1.03 catches "absent" but not "there and
  // invisible": 1.12:1 passed that floor and nobody in the room could see it. A projector eats
  // anything under about 1.3.
  const rgba = v => { const m = v.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    return m ? [[+m[1], +m[2], +m[3]], +m[4]] : null; };
  const blend = (fg, a, bg) => '#' + fg.map((c, i) =>
    Math.round(c * a + parseInt(bg.slice(1 + i * 2, 3 + i * 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
  for (const t of ['light', 'dark']) {
    const wk = vars[t]['wk']; if (!wk) continue;
    const [rgb, a] = rgba(wk);
    const eff = blend(rgb, a, vars[t]['card']);
    const r = ratio(eff, vars[t]['card']);
    r >= 1.25 ? ok('weekend band ' + t.padEnd(5) + ' ' + r.toFixed(2) + ':1')
              : bad('weekend band ' + t + ' ' + r.toFixed(2) + ':1 — ' + (r < 1.03 ? 'absent' : 'invisible on a wall'));
  }

  // v0.35.0b. THE WASH, MEASURED AT ITS DARKEST. The pairs above put the heading against --card,
  // which is the colour behind it for half a cycle and the wrong one for the other half. A wash
  // heavy enough to bury the rows underneath it would pass every declared-colour check in this
  // file, because no rule anywhere would name the blended result. So blend it and measure.
  // Both the alert heading and the ordinary row ink are checked: the rows never asked to be part
  // of an alert and must not be collateral.
  for (const t of ['light', 'dark']) {
    const on = vars[t]['db-wash-on']; if (!on) continue;
    const [rgb, a] = rgba(on);
    const eff = blend(rgb, a, vars[t]['card']);
    for (const [what, fg, floor] of [['heading', vars[t]['db-late'], 4.5],
                                     ['amber stop', vars[t]['db-slip'], 4.5],
                                     ['row text', vars[t]['text'], 4.5]]) {
      const r = ratio(fg, eff);
      r >= floor ? ok('over the wash, ' + t.padEnd(5) + ' ' + what.padEnd(10) + ' ' + r.toFixed(1) + ':1')
                 : bad('over the wash, ' + t + ' ' + what + ' ' + r.toFixed(1) + ':1, under ' + floor);
    }
    // And the wash has to be visible at all, or it is motion nobody can see.
    const seen = ratio(eff, vars[t]['card']);
    seen >= 1.06 ? ok('the wash is actually visible ' + t.padEnd(5) + ' ' + seen.toFixed(2) + ':1')
                 : bad('the wash is invisible in ' + t + ' at ' + seen.toFixed(2) + ':1');
  }
}

// ---------------------------------------------------------------- 6. colour drift
// COLOUR section removed v0.10, and it earned its retirement rather than being waved off: it
// caught the .bar.ms deletion the moment it happened.
// It asserted the campaign default agreed between CSS (.bar.ms) and JS (MS_DEFAULT), which was a
// live v0.6 defect. Both are DELETED now: a campaign draws in its PRODUCT's hue, so there is no
// campaign default, no .bar.ms and no MS_DEFAULT. The check had nothing left to measure.
// A check pointed at a deleted thing fails forever, and a suite that always fails is a suite
// nobody reads, which is how the checks that DO matter get waved through alongside it.
// The defect class it guarded is not gone and is not unwatched: --dayw and --markw killed the
// same trap by construction, giving CSS one source in JS rather than a second copy to drift.

// ---------------------------------------------------------------- 7. RPC surface
// Every RPC name and argument, cross-checked against the signatures read off prod 16/07/26,
// plus update_schedule_item / delete_schedule_item / set_item_owners read 17/07/26 for 5b,
// plus delete_task_status / delete_instrument / delete_absence_type created 18/07/26 for v0.15,
// grants verified back off pg_proc.proacl (EXECUTE present on all three) before the button was built,
// plus set_task_status_cancelled created 18/07/26 for v0.16, mirroring set_task_status_terminal.
console.log('\nALERT GRAMMAR  (v0.35.0: two red alerts, and they must not be the same red)');
{
  // This file speaks ok/bad, not is/want. Local shim rather than a new global, so the section
  // reads like the assertions it replaced without changing the harness everything else uses.
  const is = (got, want, m) => (got === want ? ok(m) : bad(m + '   got ' + JSON.stringify(got)));
  // cssNoComment throughout: the rules below now carry a block comment of their own, and matching
  // over it is how a checker starts asserting against prose that quotes the thing it tests for.
  const rule = re => (cssNoComment.match(re) || [,''])[1];
  const late = rule(/\.db-late \.db-gt\{([^}]*)\}/);
  const slip = rule(/\.db-slip \.db-gt\{([^}]*)\}/);
  is(/font-weight:\s*700/.test(late), true, 'overdue is bold');
  is(/font-weight/.test(slip), false, 'should-have-started is NOT, so the two stay distinct with motion off');
  is(/animation:\s*db-pulse/.test(slip), true, 'and it pulses');
  is(/animation/.test(late), false, 'while overdue does not: one moving thing per card, not two');

  // THE TROUGH IS A COLOUR, NOT AN OPACITY. Fading to transparent is the obvious way to blink and
  // it drops the label under the contrast floor for half of every cycle, where the harness cannot
  // see it because it reads declared colours.
  const kf = (cssNoComment.match(/@keyframes db-pulse\{([\s\S]*?\})\s*\}/) || [,''])[1];
  is(/opacity/.test(kf), false, 'no opacity anywhere in the keyframe');
  is((kf.match(/color:var\(--db-(late|slip)\)/g) || []).length >= 2, true,
     'both stops paint a named tone colour, so both are reachable by the contrast pairs above');

  const rm = (cssNoComment.match(/prefers-reduced-motion[^{]*\{([\s\S]*?)\}\s*\}/) || [,''])[1];
  is(/animation:\s*none/.test(rm), true, 'reduced motion switches the animation off');
  is(/color:var\(--db-late\)/.test(rm), true, 'and pins a static red, rather than leaving it mid-pulse');

  // The group rule itself. Dropping one animation off the shorthand leaves the other running, so
  // the group still moves and every colour assertion above still passes: a half-dead pulse that
  // looks alive. Both names are required by name.
  // EVERY match, joined. Reading the first rule for a selector that appears twice is how this
  // section shipped green while asserting nothing, and reported a full mutation set as killed.
  // MEDIA QUERIES STRIPPED FIRST. The reduced-motion block declares .db-slip legitimately, so
  // concatenating every match would fold its animation:none into the base rule and mask a dropped
  // animation. Base rules only here; the media query is checked separately below.
  const cssBase = cssNoComment.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
  const grp = [...cssBase.matchAll(/\.db-slip\{([^}]*)\}/g)].map(m => m[1]).join(';');
  is(cssBase.split('.db-slip{').length - 1, 1,
     'and .db-slip has exactly one base rule: two is how this section shipped asserting nothing');
  is(/db-pulse-rule/.test(grp), true, 'the rule down the left pulses');
  is(/db-pulse-wash/.test(grp), true, 'and so does the wash behind the rows, on the same shorthand');
  is(/border-left-width:\s*3px/.test(grp), true,
     'the rule is thickened, and statically: motion carries the alarm, width carries the fact');
  is(/background:/.test(grp), false,
     'background-color, never the shorthand, which would eat the variable it is layered on');
  is(/animation:none/.test(rm) && /\.db-slip\{[^}]*animation:none/.test(rm), true,
     'reduced motion stops the GROUP too, not only the heading');

  // The label. It names the ACTION; the diagnosis alone was what nobody acted on.
  is(/should have started \(update status\)/.test(js), true, 'the label tells the reader what to do');
  is(/dbGroup\('should have started[^']*', b\.notStarted/.test(js), true, 'and it is still the notStarted group');
}

console.log('\nRPC SURFACE');
{
  const VERIFIED = new Set(`add_absence_type add_deadline_kind add_instrument add_task_status
    create_absence create_instrument_booking create_milestone create_schedule_item delete_absence
    delete_instrument_booking delete_milestone delete_schedule_item set_absence_type_active
    set_deadline_kind_active set_instrument_active set_instrument_order set_item_owners
    set_product_active set_product_colour set_product_order set_task_status_active
    set_task_status_colour set_task_status_texture
    set_task_status_order set_task_status_terminal update_absence update_instrument
    update_instrument_booking update_milestone update_schedule_item
    delete_task_status delete_instrument delete_absence_type
    set_task_status_cancelled
    create_training update_training delete_training
    create_maintenance update_maintenance delete_maintenance
    reserve_lot_for_item reserve_lr_for_item
    update_seminar`.split(/\s+/).filter(Boolean));
  // v0.21.0 added exactly one name to this list. update_seminar was read off prod 14/07/26 for
  // seminars itself and is quoted in the reference: owner-or-admin, locked rows admin-only, owner
  // reassignment admin-only (p_owner ignored for a non-admin). It is unchanged and nothing was
  // migrated for this build.
  // The other three seminars RPCs are deliberately NOT here. create_seminar, delete_seminar and
  // set_seminar_lock are admin-only and belong to console.html, so if one of them ever appears in
  // sched.html this check should fail, and it will. That is the list doing its job, not a gap.
  const SPINE = new Set(['caller_code', 'caller_is_admin', 'caller_roster_code', 'caller_in_roster',
                         'whoami', 'team_members']);
  const used = new Set([
    ...[...js.matchAll(/rpc\('([a-z_]+)'/g)].map(m => m[1]),
    ...[...js.matchAll(/'(set_[a-z_]+_order)'/g)].map(m => m[1]),
    ...[...js.matchAll(/probeFn\('([a-z_]+)'/g)].map(m => m[1]),
  ]);
  const unknown = [...used].filter(u => !VERIFIED.has(u) && !SPINE.has(u)).sort();
  unknown.length ? bad('RPC names not verified against prod: ' + unknown.join(', '))
                 : ok(used.size + ' RPC names, all verified against prod 16-18/07/26, the two reserve wrappers 22/07/26');
}

// ---------------------------------------------------------------- 8. rules that APPLY
// CLASSES asks whether a class has a rule ANYWHERE. That is not the same question as whether it
// has one that APPLIES to the element it was emitted on, and the gap between those two questions
// shipped twice before anything asked it.
//   v0.13   .lg-ramp.away had no rule. The hatch was .lcell.away, the swatch is a .lg-ramp, so
//           the legend drew "away, and still carrying work" as a plain blue block and "away" as
//           26x12 of nothing: the legend lying about the one state Block 6 exists to show.
//           CLASSES passed, because "away" IS defined.
//   Block 4 class="btn danger" has NEVER been red. .danger exists only as .link.danger, so
//           Delete fell through to plain .btn and has looked exactly like Cancel for two blocks
//           on a call that cascades item_owners and cannot be undone. Nobody looked.
// The question: for a class that is ONLY ever written as part of a compound selector, does every
// element carrying it also carry one of the qualifiers it is written with? Classes with a bare
// rule of their own are not this check's business, and classes with no rule at all are CLASSES'.
console.log('\nRULES THAT APPLY');
{
  const html = bare;
  const bareC = new Set(), quals = {};
  const sels = [];
  cssNoComment.replace(/([^{}]+)\{[^}]*\}/g, (m, s) => { s.split(',').forEach(x => sels.push(x.trim())); return m; });
  for (const sel of sels){
    for (const unit of (sel.match(/(?:[.#]?[A-Za-z][\w-]*)(?:[.:][\w-]+(?:\([^)]*\))?)*/g) || [])){
      const cs = [...unit.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m => m[1]);
      if (!cs.length) continue;
      if (cs.length === 1) bareC.add(cs[0]);
      else for (const c of cs){ quals[c] = quals[c] || new Set(); cs.filter(o => o !== c).forEach(o => quals[c].add(o)); }
    }
  }
  const emits = [];
  for (const m of html.matchAll(/class="([^"{}+]+)"/g)) emits.push(m[1].trim().split(/\s+/));
  for (const m of html.matchAll(/class="([^"]*?)'\s*\+/g)){ const t = m[1].trim(); if (t) emits.push(t.split(/\s+/)); }
  const misses = new Set();
  for (const e of emits) for (const c of e){
    if (bareC.has(c) || !quals[c]) continue;
    if (![...quals[c]].some(q => e.includes(q)))
      misses.add('class="' + e.join(' ') + '" -> .' + c + ' is only ever styled as .'
              + [...quals[c]].map(q => q + '.' + c).join(' / .'));
  }
  misses.size ? misses.forEach(m => bad(m)) : ok(emits.length + ' class emissions, every compound-only class carries a qualifier that styles it');
}

// ---------------------------------------------------------------- 9. the lift
// the queue's <style> block is lifted verbatim and shared with the queue and seminars, and the
// standing instruction is "do not edit inside it, override outside it". Until v0.11 NOTHING
// enforced it: the instruction carried a LINE RANGE, and a line range in a header that grows
// above it encodes a position it does not own. Recorded as 582-689; measured at 792-899 on
// 17/07/26; moved to 899-1006 by v0.11's own change-history entry in the same session. So no
// line numbers here either. Find the block by its BOUNDARIES and hash what is between them.
// A deliberate re-lift from a newer the queue SHOULD fail this and update the hash. Loud is the
// feature, the same way "do not use if not exists" is.
// ---------------------------------------------------------------- the background shorthand
// THIRD time the background shorthand has eaten a background-image: the sticky column in
// v0.9.3, then in v0.16 the cancelled strike on the bar AND on the legend swatch, both at once.
// The pattern is mechanical. A layered texture (the away hatch, the cancelled strike) is a
// class background-IMAGE; an inline "background:<hue>" is the SHORTHAND, which resets
// background-image to none, and inline beats a class even with !important on the longhand. So:
// no element that can carry a layering class may set the background shorthand inline. It must
// use background-color. Every prior instance was invisible until a screenshot; this makes it
// fail here instead.
console.log('\nBACKGROUND SHORTHAND');
{
  const layerable = /\b(bar|lg-ramp|lg-strike)\b/;
  const offenders = [];
  // (1) literal markup: a class="...bar..." with an inline background shorthand, either order.
  for (const m of bare.matchAll(/<i\b[^>]*?class="([^"]*)"[^>]*?style="([^"]*)"/g))
    if (layerable.test(m[1]) && /(^|;)\s*background\s*:/.test(m[2])) offenders.push('swatch .' + m[1].trim());
  for (const m of bare.matchAll(/<i\b[^>]*?style="([^"]*)"[^>]*?class="([^"]*)"/g))
    if (layerable.test(m[2]) && /(^|;)\s*background\s*:/.test(m[1])) offenders.push('swatch .' + m[2].trim());
  // (2) the recurring one, and the reason a screenshot caught it three times: the hued bar's
  // style is BUILT by concatenation and the bar always carries a background-image class
  // (.bar.xcl / .bar.ab), so a "background:<hue>" shorthand there resets the strike or hatch to
  // none. This is the ONE branch that feeds a .bar, pinned by its inkOn() neighbour, which no
  // other style in the file has: a broader "any built background:" match would flag the weekend
  // band and every legend fill, which are not layerable, so it is deliberately this one line.
  const barStyle = js.match(/:\s*'(background[^']*?)' \+ esc\(b\.colour\) \+ '[^']*?' \+ inkOn/);
  if (barStyle && !/^background-color:/.test(barStyle[1]))
    offenders.push('the hued bar style uses "' + barStyle[1] + '" not background-color, so .bar.xcl / .bar.ab cannot layer');
  offenders.length
    ? offenders.forEach(o => bad('inline background shorthand where a background-image can layer (use background-color): ' + o))
    : ok('no inline background shorthand on any layerable element or built bar style');
}

console.log('\nTHE LIFT');
{
  // Comments are prose. THIRD time in this project: HANDLERS read a typo out of a comment
  // quoting it, the logic test read a deleted name out of a comment saying it was deleted, and
  // the first cut of THIS check found the <style> in the header comment's own sentence about
  // the lifted <style> block and reported the stylesheet as edited on a clean file. Anything
  // that reads markup must strip the prose about the markup first.
  // RE-LIFTED for the port, deliberately, which is what the failure message below asks for.
  // The only edit inside the block is the .auth-* removal: fourteen rules out, one [REMOVED]
  // comment in, verified by diffing the block against the original rather than by trusting the
  // hash to be about what I thought it was about. Everything else in the lifted stylesheet is
  // byte-identical, which is the property this assertion exists to hold.
  const LIFT = '6b37606260f4ae51';
  const bare = src.replace(/<!--[\s\S]*?-->/g, '');
  const i = bare.indexOf('<style>');
  const j = bare.indexOf('\n', bare.indexOf('  .footer{', i));
  const block = bare.slice(i, j + 1);
  const h = require('crypto').createHash('sha256').update(block).digest('hex').slice(0, 16);
  h === LIFT
    ? ok('lifted the queue block intact: ' + (block.split('\n').length - 1) + ' lines, sha256[:16] ' + h)
    : bad('the lifted block has been EDITED: sha256[:16] ' + h + ', want ' + LIFT
          + '. Override outside it, or re-lift deliberately and update the hash here.');
}

console.log('\nVIEWING AS');
{
  // NEW with the picker. The session half is asserted against core.js in queue_checks.cjs and
  // sched_logic.cjs; this is the page half: the control is in the header, a change goes to core.js
  // and reloads, and the page signs in through the path that reads the choice.
  const bare = src.replace(/<!--[\s\S]*?-->/g, '');
  const header = (bare.match(/<div class="header-right">[\s\S]*?<\/div>/) || [''])[0];
  /<select data-viewas onchange="viewAsChange\(this\.value\)">/.test(header)
    ? ok('the Viewing as picker is in the page header') : bad('the Viewing as picker is missing from the header');
  /function viewAsChange\(code\)\{ core\.setViewingAs\(code\); location\.reload\(\); \}/.test(js)
    ? ok('a change goes to core.js and reloads') : bad('the picker does not hand its choice to core.js');
  /core\.signInDefault\(\);\s*viewAsFill\(core\.DEFAULT_USER\);/.test(js)
    ? ok('the page signs in through signInDefault, the default chemist when nobody is picked')
    : bad('the page does not sign in through the path that reads the picker');
  /off the roster,[\s\S]{0,60}closed to it/.test(js)
    ? ok('an off-roster account is told so on the page, not only by a toast')
    : bad('an off-roster account gets a toast and a blank page');
  // Found in the browser: #app starts hidden, so a refusal that never shows it strands the person
  // on a blank page with the picker hidden along with everything else.
  /if \(!rosterCode\)\{[\s\S]{0,500}?showScreen\('app'\)[\s\S]{0,200}?closed to it/.test(js)
    ? ok('and the refusal shows the page shell, so the picker is still there to switch back')
    : bad('an off-roster account is refused onto a blank page with the picker hidden');
}

// ---------------------------------------------------------------- probe gate  [REMOVED]
// One assertion: the probe tab was un-hidden on the roster code and never on caller_is_admin,
// because gating a diagnostic on the thing it diagnoses hides it in exactly the fault it
// exists to catch. That reasoning is worth keeping in view even though the button is gone,
// which is why it is written here rather than deleted silently. It is one of the two probe
// assertions that are about the PANEL rather than about the register, so it goes.

// ---------------------------------------------------------------- build currency  [REMOVED]
// Seven assertions, deleted with the feature: the head-line-vs-BUILD_ID agreement, the
// no-store fetch, the byte Range rather than pulling the whole file every poll, that the
// check never navigates by itself, that it fires on focus and visibilitychange rather than
// on a timer alone, that the banner is static markup hidden until it has something to say,
// and that .banner-build uses fixed colours rather than theme variables.

console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'all checks pass'));
process.exit(fails ? 1 : 0);
