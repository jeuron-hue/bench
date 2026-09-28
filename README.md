# bench

## Summary

From 2021 to 2026 I ran the technical development department of a GMP contract manufacturer of pharmaceutical intermediates in Singapore. A team of eight chemists, taking processes from the lab through tech transfer at 100 to 1500 kg.

The department's planning lived in spreadsheets. Who was doing what, which lot and lab report numbers were taken, who was away, who owned which instrument: each in its own file, each with its own copy of the team. Nobody had one view of the week.

I built three browser tools to replace them, on my own, alongside the day job, with no budget and no server to maintain: a schedule and dashboard, a register for lot and lab report numbers, and an admin console. They were in daily use until I left.

The dashboard shows each chemist what is on their plate that day and helps them manage their time. The hardest problem was not the schedule. It was people joining and leaving. The first departure showed that one "active" flag was being asked to describe people in very different situations: a trainee who should be given work but not change records, a leaver serving notice who keeps their work but takes on nothing new, and someone already gone whose name must stay on everything they signed. Splitting that flag into independent controls, and checking that no screen confuses them, is most of what the admin console does.

This repository is a working copy of those tools. The pages are the original code. The database is replaced by the browser's own storage, and the people, products and records are invented. Use "Viewing as" in any tool's header to become a trainee, a leaver or someone who has already gone, and see what each tool shows and refuses.

Every rule is covered by automated checks, and a mutation test proves those checks would notice if a rule broke. How that works is below.

---

## How it works

This half of the document is for a reader who manages a laboratory rather than writes software.
It explains what the parts are, why they are arranged the way they are, and how the code is
checked. It makes no claims about what the tools achieve in use.

### 1. Three tools, one dataset

The bench is three web pages that share a single set of records. A fourth page, `index.html`,
links to the three. It holds no data of its own.

| Page | Tool | What it records |
|---|---|---|
| `sched.html` | Work Schedule | Who is doing what, and when: tasks, campaign milestones, absences, instrument bookings, training, maintenance and duty rotas. A timeline, a per-person dashboard and a workload view. |
| `queue.html` | Queue Number System | The register. Lot numbers and lab report numbers are reserved here, linked to each other, locked and signed. |
| `console.html` | Admin Console | The roster and the setup lists: people, products, task statuses, instruments, holidays, duty types. Also offboarding, which hands a leaver's open items to somebody else before they go. |

The three were built one after another and each started out with its own copy of shared
details. Keeping them on one dataset is deliberate: a lot number reserved from a schedule
task is the same record the register shows, and a roster change made in the console is seen
by the other two the next time they load.

**The register's numbering rule.** A new lot or lab report takes the lowest free number for
that product and year. A number that is released becomes free again. A number that was
skipped stays skipped. Nothing is ever renumbered, because a number that has been written on
a sample or a notebook page must keep meaning the same thing.

**Locking.** A lot locks once the record says the work is done: a lab report is linked, the
experiment has an end date, or, for a use-test lot, the second check date is in. A locked lot
cannot be released, and its owner cannot edit it. There are two exceptions. A use-test lot
waiting only for its final check date may still take that date and nothing else. And the
administrator may edit any locked lot from the console's Edit tab, for example to clear a
mistaken end date and reopen it; every such edit is written to an edit log that records the
lot before and after. Lots marked frozen, carried over from an earlier year, cannot be edited
by anyone. A lab report cannot be signed
until at least one lot is linked to it, unless it is marked standalone, in which case it
cannot be signed with any lots linked. Revising a signed report keeps its number and archives
the earlier revision.

### 2. The shared backbone, and what it stands in for

All three pages load two scripts before their own code: `seed.js` and `core.js`.

**`core.js` is the backbone.** In the system these tools were taken from, the records lived
in a hosted database. Each person signed in, the database checked their permissions on every
request, and every change went through a named server-side function that could refuse it.
`core.js` reproduces that arrangement inside the browser so the tools can run without it:

- **Reads are a fixed list.** There are 24 named reads, such as "all lots, ordered by product
  then sequence". A page asks for one by name. It cannot write its own query, so there is no
  way for a page to ask for something the list does not already describe.
- **Every change is a named function.** Reserving a lot, signing a report, setting somebody's
  roster end: each is one function in `core.js`, and each checks who is asking before it
  touches anything. A page that tries to change a record any other way changes nothing,
  because what a page receives is a copy.
- **Sign-in is kept, the sign-in screen is not.** In its place, each tool's header has a
  **Viewing as** list of everybody on the roster. Picking a person signs the tools in as that
  person, and every tool then behaves as it would for them: what they see, what they are
  offered and what they are refused. The choice is shared by all three tools and kept between
  visits. Until somebody is picked, the schedule and the queue open as an ordinary chemist and
  the console as the administrator. There are no passwords.
- **The clock is fixed.** Every page believes it is 09:00 on 10 June 2026, Singapore time.
  This keeps the sample data meaningful: without it, every task in the sample would drift into
  the past and the tools would show nothing but overdue work.

**`localStorage` stands in for the database.** The whole dataset is stored as one entry in
the browser's own storage on the machine it runs on. The consequences are worth stating
plainly, because they are the main ways the bench differs from the hosted system:

- **It is one person's copy.** Nothing is shared between machines or between people. Two
  people using the bench see two separate datasets.
- **It is one browser's copy.** A different browser on the same machine starts fresh.
- **Some browsers refuse storage** for a page opened straight from a file, in a private
  window, or when site data is blocked. In that case the pages keep working from memory. The
  footer of each page says which mode is live. In memory mode, changes last until the tab is
  closed and are not carried from one tool to another.
- **Reset data**, in each tool's header, throws away local changes and rebuilds the sample
  dataset from `seed.js`.

**`seed.js` builds the sample dataset.** It runs once, when there is nothing stored. The
people, products and records are fictional. It uses a fixed random seed, so the same data
appears on every machine and after every reset. That is what makes a screenshot or a test
run repeatable. It covers 21 weeks, March to July 2026, so there is both past and future
around the fixed date. The eight people in it are chosen so that every case the permission
rules distinguish is present once: an administrator, active chemists, a trainee, somebody
whose last day is still ahead, and somebody who has already left.

### 3. Who may do what: the posture model

A person on the roster has two properties that matter here. One is an **active** flag. The
other is an optional **roster end date**, normally their last day in the lab. The tools
combine these into what the code calls *postures*. The numbers are labels carried over from
the original system's notes, not a scale, and only 1, 2, 3 and 5 are used.

| Posture | How it is set | What it means |
|---|---|---|
| **1** | Active, no roster end | Normal. Reads and writes. |
| **2** | Inactive, no roster end | A trainee, or somebody on long absence. Stays on the lists that give work *to* them. The only change they can make is to their own absences. |
| **5** | Inactive, roster end set, date still ahead | A leaver working out their notice. Keeps everything they hold and is offered nothing new. Their live work is handed over from the console's Offboard tab. |
| **3** | Roster end date has passed | Gone from every list in every tool. Their name stays on every record they already hold, permanently. Refused all changes. |

**What each tool lets them do.** The schedule lets posture 2 and 5 read everything. The queue
has no read-only view: it refuses posture 2, 3 and 5 outright. The console is for the
administrator alone and shows anyone else a "Not authorised" screen.

**Where posture 5 appears, and where it does not.** Somebody in posture 5 is still on the
schedule's timeline, dashboard and workload view, can still be recorded as away, and is still
on the console's roster, with a pill showing their last day. Their name also stays on every
task, lot, report and duty they already hold. They are left out of every list that hands out
something new: task owner, trainee, campaign lead and co-lead, instrument booking, training
mentor, the queue's owner list, and the console's mentor, instrument, role and duty lists. Two
further lists also leave them out, because those lists show only active people: the queue's
**Open items** board and the schedule's chemist filter, so a leaver's open lots and reports do
not appear on that board. A leaver keeps everything they hold and is offered nothing new. Their
live work is handed over from the console's **Offboard** tab, which lists everything the person
holds and reassigns or releases each item.

The console's two buttons move people between postures. **Deactivate** moves 1 to 2.
**Setting a roster end** on somebody inactive moves them to 5, so a leaver takes both buttons:
Deactivate and Set roster end. When the date passes they move to 3 by themselves. Neither
of these is **Remove**, which deletes the roster entry outright and exists for the case where
somebody was added by mistake.

The distinction between 2 and 5 matters in practice. A trainee given a roster end date by
mistake drops out of the lists that exist to give them work. A leaver who is only deactivated
stays on the dashboard with work against their name.

**Two questions, two rules.** The pages ask two different questions about a person, and each
question has exactly one rule behind it:

- **Is this person still here?** The rule is *on team*: no roster end date, or one that is
  today or later. Their last day counts as a day they are here. This rule decides who appears
  on the timeline, on the dashboard, in the workload view and in the absence and booking
  fields. A person in posture 5 passes it. They are still here.
- **May this person be offered something new?** The rule is *not leaving*: no roster end date
  at all. It never looks at what the date is, because the point is to stop creating work that
  will need handing over, and that is true from the moment a leaving date is set. This rule
  decides who is offered as a task owner, a trainee, a campaign co-lead, or the person on a
  duty rota.

Neither rule reads the active flag. That flag is what separates posture 1 from posture 2, and
posture 2 must stay on the lists. Where somebody is *already* assigned, they stay shown and
ticked even if a rule would now exclude them, so opening a task to edit something else never
silently removes a person from it. Removing them is a decision somebody makes.

Each rule is written once per page, and the test suites check that there is exactly one copy
of each. Two copies of a date boundary tend to disagree by a day, and nobody notices until it
matters. The rules on the pages only decide what is *shown*. The refusal itself is in
`core.js`, which turns away a posture-3 person by date and a posture-2 or posture-5 person by
the flag, with different messages, because the two are fixed by different people. The one
change it lets an inactive person make is to an absence of their own.

### 4. How the code is checked

**The checkers.** Four test suites run under Node.js, outside any browser. Each reads a page's
source and runs its functions against fixed inputs.

| Suite | Covers |
|---|---|
| `sched_checks.cjs` | The schedule page's structure: every style it uses is defined, text stays readable against its background, every button and field is wired to something that exists. |
| `sched_logic.cjs` | The schedule page's rules: lateness, the dashboard's grouping of tasks, who may edit what, the two roster rules. Also the rules in `core.js` for task start dates and for who may record an absence. |
| `queue_checks.cjs` | The register page, and the permission checks in `core.js`, including that picking somebody under Viewing as really does sign the tools in as them. |
| `admin_checks.cjs` | The console: every table row has as many cells as its header, every server function it calls exists in `core.js`, a non-administrator gets the Not authorised screen, and an edit of a locked lot is logged. |

Most checks in these files exist because a specific fault reached the working tools, and the
comment beside each one says which. They cannot see layout, spacing or whether a screen
answers the question it was built for. Those still need a person looking at it.

**Mutation testing.** A passing suite shows the code agrees with the tests. It does not show
the tests would notice if the code were wrong. `mutations.cjs` addresses that. It holds a list
of deliberate faults, each one a small edit that breaks a single rule: the roster rule
ignoring the date, the clock reading the real time, the write gate letting a leaver through,
the workload view counting hours instead of shares of a day. It applies them one at a time,
runs all four suites against each, and restores the file afterwards. Every fault must turn at
least one suite red.

A fault that no suite catches is called a survivor. The rule for a survivor is that the tests
are too loose, never that the fault was unfair. The response is to add the missing check, not
to soften the fault. Three faults survived the first run, and each one exposed a gap of the
kind that fails without any visible error: a blank workload view, a leaver who could still
make changes, and a reorder that renumbered only one row. The checks that now catch them are
marked in their suites.

**The scrub.** `bench_scrub.cjs` scans every file headed for the repository for names,
credentials and references to the original deployment, and fails on any match. The list of
what it looks for is not in the repository, because publishing that list would publish its
contents. The scrub reads it from a local file that is never committed, and refuses to run
without it. The hook in `.githooks/pre-commit` runs the scrub before every commit in the
maintainer's copy, so nothing it catches can be committed there without the hook being
bypassed on purpose.

### 5. Running it locally

**To use the tools**, a current version of Chrome, Edge, Firefox or Safari is enough. Nothing
needs installing and nothing is fetched from a server apart from the typeface.

1. Download or clone this repository.
2. Open `index.html` in the browser.

If the footer says the data is held in memory rather than stored, the browser is refusing
storage for local files. Serving the folder avoids that. With Python installed, from inside
the folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

**To run the checks**, install Node.js, then from inside the folder:

```bash
node sched_checks.cjs
```

```bash
node sched_logic.cjs
```

```bash
node queue_checks.cjs
```

```bash
node admin_checks.cjs console.html
```

Each prints one line per check and ends with either a pass line or a count of failures.

```bash
node mutations.cjs
```

This prints one line per deliberate fault and which suites caught it. It edits the page files
while it runs and puts them back when it finishes. Run `git status` afterwards anyway.

The scrub and its commit hook need the private list described above, so in a fresh clone the
scrub stops with a message saying the list is missing. That is intended.

### Licence

MIT. See `LICENSE`.
