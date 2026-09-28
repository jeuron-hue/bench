#!/usr/bin/env node
/*
  bench_scrub.cjs  -  the scrub gate.

  Runs over every tracked file plus every untracked, non-ignored file, and exits
  non-zero on any hit. All matching is case-insensitive.

  THE LIST IS NOT IN THIS FILE. It lives in reference/scrub_list.json, which is
  gitignored with the rest of reference/. A banned list committed to a public
  repository publishes exactly what it exists to keep out, so this file carries
  the rule logic only and reads the words at run time. Set BENCH_SCRUB_LIST to
  point at a copy elsewhere, for example when scanning an old commit checked out
  into a separate worktree.

  FAILS CLOSED. No list, an unreadable list, or a list missing any of its
  sections is exit 2 with a message saying which. A gate that cannot see its
  list must not report a clean tree.

  Scope note: the file list is `git ls-files` plus `git ls-files --others
  --exclude-standard`. The second list honours .gitignore, so reference/ is not
  scanned. That is deliberate: reference/ is the specification and holds the list
  itself. If reference/ ever stops being ignored, it starts being scanned, and
  this gate fails loudly rather than quietly.

  SELF-SCAN: this file is scanned like any other, with nothing blanked and no
  exemption. It holds no banned string, so it passes; the day one is pasted into
  it, including into a comment, it stops passing.
*/
'use strict';
const fs = require('fs');
const cp = require('child_process');
const path = require('path');

/*
  Person-name rules only are lifted on these two files, so an author line or a
  copyright holder can stand. EXACT repo-relative paths, not basenames: a nested
  docs/README.md gets no exemption, because the narrow rule is the safe one.

  Every other rule - person codes, banned tokens, credentials, project refs, the
  programme names - stays fully live on these files. The exemption is scoped by
  rule, not by file: an exempt file is still scanned, just with the person rules
  removed from the set. A leaked key in README.md still blocks the commit.
*/
const PERSON_EXEMPT = new Set(['README.md', 'LICENSE']);

function git(args) {
  return cp.execSync('git ' + args, { encoding: 'utf8', maxBuffer: 1 << 28 });
}

// ------------------------------------------------------------ the list, read at run time
function fail(msg) {
  console.error('SCRUB CANNOT RUN: ' + msg);
  console.error('The gate fails closed. Nothing has been scanned and nothing may be committed.');
  process.exit(2);
}

function listPath() {
  if (process.env.BENCH_SCRUB_LIST) return path.resolve(process.env.BENCH_SCRUB_LIST);
  let top;
  try { top = git('rev-parse --show-toplevel').trim(); }
  catch (e) { fail('not inside a git work tree, so there is no reference/ to read the list from.'); }
  return path.join(top, 'reference', 'scrub_list.json');
}

const SECTIONS = ['codes', 'tokens', 'people', 'name_tokens', 'literals', 'patterns', 'markup_tokens'];

function loadList() {
  const p = listPath();
  if (!fs.existsSync(p)) fail('the banned list is missing: ' + p);
  let list;
  try { list = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { fail('the banned list is unreadable: ' + p + ' (' + ((e && e.message) || 'parse failed') + ')'); }
  for (const s of SECTIONS) {
    if (!Array.isArray(list[s])) fail('the banned list has no "' + s + '" array: ' + p);
  }
  // An empty person list is the one gap that looks like a pass, so it is refused outright.
  if (!list.people.length) fail('the banned list names no people: ' + p);
  for (const pt of list.patterns) {
    if (!pt || typeof pt.re !== 'string') fail('a pattern entry has no "re" string: ' + p);
  }
  return list;
}

const LIST = loadList();

// ------------------------------------------------------------ the rules
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const token = s => new RegExp('\\b' + esc(s) + '\\b', 'gi');

const RULES = [
  { name: 'jwt',       re: /eyJ[A-Za-z0-9_\-+/]{8,}={0,2}/g,         what: 'JWT-shaped string' },
  { name: 'dataimage', re: /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]{32,}/gi,
                       what: 'data:image base64 blob' },
];
for (const pt of LIST.patterns) {
  RULES.push({ name: 'pattern', re: new RegExp(pt.re, 'gi'), what: pt.what || 'banned pattern' });
}
for (const c of LIST.codes) {
  RULES.push({ name: 'code', re: token(c), what: 'person code ' + c });
}
for (const t of LIST.tokens) {
  RULES.push({ name: 'token', re: token(t), what: 'banned token ' + t });
}
for (const p of LIST.people) {
  RULES.push({ name: 'person', person: true, re: new RegExp('\\b' + esc(p).replace(/\s+/g, '\\s+') + '\\b', 'gi'), what: 'person name ' + p });
}
for (const t of LIST.name_tokens) {
  RULES.push({ name: 'person', person: true, re: token(t), what: 'name token ' + t });
}
for (const l of LIST.literals) {
  RULES.push({ name: 'literal', re: new RegExp(esc(l), 'gi'), what: l });
}

/*
  MARKUP TOKENS. A banned standalone token can also be the name of an HTML element,
  and then the file is full of it as markup: opening and closing tags, and CSS rules
  that select the element. Those are markup, not the banned word, so a hit is
  suppressed when the match is the lowercase form AND it is either tag-shaped or
  inside a <style> block. Everything else, prose included, fires.

  Suppressions are COUNTED, never silently dropped: the count prints on every run,
  so a suppression can never hide a real hit.

  Tag-shaped means preceded by "<", "</" or "<\/" and followed by whitespace, ">" or
  "/". The optional backslash is there so an ESCAPED closing tag inside a JS regex
  literal is recognised as the markup it is; a two-character lookback saw only "\/"
  there and fired on every checker that matches a table cell.
*/
let markupSuppressed = 0;
function markupHits(text, lineOf) {
  const out = [];
  if (!LIST.markup_tokens.length) return out;
  const styleRanges = [];
  for (const m of text.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)) {
    styleRanges.push([m.index, m.index + m[0].length]);
  }
  const inStyle = i => styleRanges.some(r => i >= r[0] && i < r[1]);
  for (const t of LIST.markup_tokens) {
    const lower = t.toLowerCase();
    for (const m of text.matchAll(token(t))) {
      const i = m.index;
      const before = text.slice(Math.max(0, i - 3), i);
      const after  = text.slice(i + m[0].length, i + m[0].length + 1) || '>';
      const isTag = /<\\?\/?$/.test(before) && /[\s>/]/.test(after);
      if (m[0] === lower && (isTag || inStyle(i))) { markupSuppressed++; continue; }
      out.push({ what: 'standalone token ' + t, index: i, text: m[0], line: lineOf(i) });
    }
  }
  return out;
}

// ------------------------------------------------------------ the scan
function fileList() {
  const run = a => git(a).split('\n').filter(Boolean);
  const seen = new Set();
  for (const f of run('ls-files')) seen.add(f);
  for (const f of run('ls-files --others --exclude-standard')) seen.add(f);
  return [...seen].sort();
}

function readScannable(f) {
  let buf;
  try { buf = fs.readFileSync(f); } catch { return null; }
  if (buf.includes(0)) return null;                       // binary
  return buf.toString('utf8');
}

let hits = 0, scanned = 0, skipped = 0, exempted = 0;
for (const f of fileList()) {
  const text = readScannable(f);
  if (text === null) { skipped++; continue; }
  scanned++;

  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const lineOf = idx => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };

  const personExempt = PERSON_EXEMPT.has(f);
  if (personExempt) exempted++;

  const found = [];
  for (const r of RULES) {
    if (r.person && personExempt) continue;
    r.re.lastIndex = 0;
    for (const m of text.matchAll(r.re)) {
      found.push({ what: r.what, index: m.index, text: m[0], line: lineOf(m.index) });
    }
  }
  found.push(...markupHits(text, lineOf));
  found.sort((a, b) => a.index - b.index);

  for (const h of found) {
    hits++;
    const shown = h.text.length > 48
      ? h.text.slice(0, 45).replace(/\s+/g, ' ') + '...(' + h.text.length + ' bytes)'
      : h.text;
    console.log('  HIT   ' + f + ':' + h.line + '  ' + h.what + '  ->  ' + JSON.stringify(shown));
  }
}

console.log('');
console.log('scanned ' + scanned + ' file(s), skipped ' + skipped + ' binary, ' +
            markupSuppressed + ' markup tag(s) suppressed, ' +
            exempted + ' name-exempt, ' + hits + ' hit(s)');
if (PERSON_EXEMPT.size) console.log('name-exempt paths (person rules only): ' + [...PERSON_EXEMPT].join(', '));
process.exit(hits ? 1 : 0);
