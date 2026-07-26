# TURN 2 — DESIGN PLAN

## Direction: "British worksite instrument"

The people using this hold it in one hand, outdoors, between tasks. The design references the physical objects it replaces: the clipboard job sheet, the stamped label plate on a machine, the carbon-copy invoice book, BS-standard site signage. Not nostalgia — those objects solved daylight legibility, glanceability, and trust-at-arm's-length decades ago, and we inherit their answers. The register is *equipment, not app*.

One consequence up front, argued against the industry default: **light theme is the default, not dark.** Dark UIs die in sunlight; every field-first surface here is paper-light with ink-dark text at maximum contrast. A dark theme exists for the office at night, as a preference, never the identity.

## Tokens

**Colour** (semantic names; tenant accent replaces `--brand` — see vocabulary layer):

| Token | Hex | Role |
|---|---|---|
| `paper` | `#F7F6F2` | app background — warm worksheet white, not blue-white |
| `sheet` | `#FFFFFF` | cards, rows, surfaces |
| `ink` | `#1A1C1E` | primary text — near-black, never pure |
| `graphite` | `#565B61` | secondary text, rules, form lines |
| `brand` (platform default) | `#2E4A3A` | deep bronze-green — British workwear/machinery heritage; replaced by tenant colour post-Genesis |
| `hivis` | `#F5A800` | warnings only — high-vis amber, earned scarcity |
| `signal` | `#C8321E` | destructive/danger only |
| `trace` | `#2456C9` | links, info, blueprint references |
| `pass` | `#2C7A3F` | success/paid/complete states |

Rule: `hivis` and `signal` appear only when something is genuinely wrong or dangerous — a screen with amber on it means *act*. Status colours never decorate.

**Type** (three roles, all open-source, all with tabular numerals where used for figures):

- **Display / labels:** *Archivo* — a grotesque with real width axes; used SemiExpanded, capitals, tracked out, for labelplates and section headers. Engineering-drawing energy.
- **Body:** *Public Sans* — the US/UK civic-adjacent workhorse; sober, extremely legible small, and deliberately *not* Inter (the default-tell of AI-built SaaS).
- **Data:** *IBM Plex Mono* — every money figure, invoice number, quantity, and timestamp renders in mono with tabular numerals. Numbers are the product's cargo; they get their own voice and perfect column alignment everywhere.

Scale: 15px body floor on mobile (17px in Site Mode), 1.25 ratio, weights 400/600 only (700 reserved for labelplates). Line length capped ~68ch on desktop.

**Space, shape, depth:** 8pt grid; radius 6px (10px on primary buttons) — softened instrument, not zero-radius broadsheet and not bubble-SaaS; borders are 1px `graphite`-at-20% *form rules*, used like the lines on a paper job sheet to structure rows and totals; shadows almost absent — one elevation for sheets, one for overlays. Depth comes from rules and contrast, not blur.

## Layout concept

Mobile: bottom tab bar, role-composed — Field sees `Today · Work · Camera · Money(own) · More`; Office sees `Pipeline · Calendar · Work · Money · More`; Owner adds Vitals as home. Every screen: labelplate header, content, one primary action thumb-reachable bottom-right. Lists are **worksheet rows**: dense single-line rows with a mono right-column (money/time), divided by form rules — an operator scans 20 per screen without scrolling fatigue.

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ ▤ JOBS            ⌕  ◷sync✓ │        │ VITALS                       │
│──────────────────────────────│        │                              │
│ Mrs Patel · Roof conv   £8,4K│        │  CASH TODAY        £12,480   │
│ ◔ In progress · Dan,Mo   Tue │        │  30-day proj        £9,120   │
│──────────────────────────────│        │   (after tax set-aside)      │
│ 14 Elm St · Survey       9:00│        │                              │
│ ○ Booked · Amy           Wed │        │  ── quiet, one column,       │
│──────────────────────────────│        │     five numbers, air ──     │
│ Kestrel Ct · Snag fix    £340│        │                              │
│ ⚠ Awaiting variation OK  Thu │        │                              │
└──────────────────────────────┘        └──────────────────────────────┘
   operator surface: dense rows            owner surface: calm, sparse
```

Desktop office view: left rail (labelplates as nav), worksheet-density centre, context panel right (the open entity's timeline). The same components, recomposed — no separate "desktop design."

## Signature element: the labelplate — and its christening

**The labelplate** is the persistent visual DNA: every module header and entity type is rendered as a stamped equipment plate — Archivo SemiExpanded caps, tracked, on a `brand`-coloured plate with a subtly debossed edge — carrying **the tenant's word**: `JOBS` for the installer, `APPOINTMENTS` for the groomer, `MATTERS` for the law firm. The universal machine wearing this company's engraved nameplates is the thesis made visible on every screen.

**The christening** is the one orchestrated motion moment, at the end of Genesis: the workspace assembles with canonical grey placeholder plates (`WORK ITEMS`, `CONTACTS`), then — as the manifest applies — each plate re-stamps to the tenant's vocabulary and the tenant's colour floods `--brand`, top of screen to bottom, ~1.8s total, skippable, honoured absent under reduced-motion (plates simply appear finished). It's the product's "hello, this is *yours* now," and the only theatrical animation in the entire app.

## The vocabulary & branding layer, visually

- Tenant colour ingestion: owner picks/brand-uploads a colour; we compute an accessible pair (plate colour + on-plate text) and a tint ramp; if their colour fails AA against `paper`, we auto-deepen and show them why in plain words. `hivis`/`signal`/`pass` are *never* tenant-overridable — safety semantics stay constant.
- Logo appears in exactly three places: their portal, their documents, the app's More screen. The working screens carry their colour and words, not their logo — restraint keeps the instrument feel.
- Every string that names an entity flows through the term service (D20) — including empty states ("No appointments yet — your diary starts here") and error copy.

## Component notes (the ones that carry the system)

- **Status stamps:** state-machine states render as bordered mono chips, uppercase, colour-coded by semantic (never by whim) — `BOOKED` graphite, `IN PROGRESS` brand, `PAID` pass, `OVERDUE` signal.
- **Sync chip:** persistent, tiny, top-right — `✓ synced` graphite / `◷ 3 queued` brand / `⚠ needs review` hivis, tap opens the queue. Honest state, always visible, never modal.
- **Conflict card** (D15): two columns, plain words, two buttons — "Dan marked complete (offline, 14:20)" vs "Amy cancelled (15:05)" — the most carefully worded component in the app.
- **Checklist rows:** 56px touch height (64 in Site Mode), tick target the full row-left, required items carry a small `hivis` dot until satisfied; photo-required rows show the thumbnail slot inline.
- **Money surfaces:** totals separated by a double form-rule (the accountant's underline), every figure mono, VAT breakdown always visible pre-issue.

## Site Mode

A one-tap toggle (auto-suggested for Field roles): 17px body floor, 64px touch targets, contrast pushed toward AAA, sync chip enlarged, camera on the tab bar. Designed for gloves, sunlight, and hurry — this is the brief's mobile-first constraint taken as a *mode*, not a compromise smeared over every screen.

## Motion & accessibility

Motion: the christening, the sync chip's state morph, checklist tick confirmation (an 80ms stamp-down), and nothing else ambient. All honoured absent under `prefers-reduced-motion`. Accessibility floor per brief §2: full keyboard paths, visible focus (2px `trace` ring), semantic labels vocabulary-aware ("Mark appointment complete"), AA everywhere, AAA in Site Mode.

## Generic-check review (required by the brief — what I changed and why)

First-pass instincts audited against the banned defaults and the AI-design tells: (1) my initial accent instinct was a utility blue — rejected as the SaaS default-tell; replaced with deep bronze-green, a choice with a British-worksite story, demoting blue to links only. (2) First-pass body face was Inter — rejected as *the* AI-build tell; Public Sans chosen for civic sobriety. (3) The vitals screen wanted the big-number-plus-gradient hero — banned by the brief; replaced with the calm mono column, no decoration, workings-on-tap. (4) Dark-by-default was considered and rejected *for the subject's sake* (sunlight), which is the kind of reason the brief demands. (5) Checked against the three banned looks: no cream+serif+terracotta, no near-black+acid, and the form rules are worksheet structure at 6px radius with generous spacing — not broadsheet hairline columns. The one aesthetic risk taken and defended: rendering *all* numerals in mono everywhere — unusual in consumer-grade UI, exactly right for a product whose cargo is numbers.

*STATE/DECISIONS updated (D24–D27). Turn 3 on your go: Slice 1 — environments, CI, probe-suite skeleton, auth, front door, invitations.*
