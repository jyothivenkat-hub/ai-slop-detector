# AI Slop Detector and Watermark Remover

**Live: https://ai-slop-detector-xi.vercel.app**

Two local, no-key tools in one app:

1. **AI Slop Detector** ([`index.html`](index.html)) audits prose and code for
   AI slop, scores it on named axes, and can rewrite the prose. All detection
   and the local cleaner run entirely in the browser, no backend required.
2. **AI Watermark Remover** ([`watermark.html`](watermark.html)) strips
   invisible Unicode, AI provenance metadata, and C2PA marks from text and
   files. This half calls a small Python backend.

For how it is put together and how to build one yourself, see
[ARCHITECTURE.md](ARCHITECTURE.md).

## Run locally

```bash
python3 server.py
```

Open `http://127.0.0.1:8020/` for the slop detector and
`http://127.0.0.1:8020/watermark.html` for the watermark remover.

The local server starts the fork-backed stdlib Python service on
`127.0.0.1:8767` and proxies the API below. On Vercel there is no subprocess:
each `/api` route is a serverless function that calls the same logic directly
(see `api/`).

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Liveness check |
| `/api/capabilities` | GET | Which scorers and tools are available |
| `/api/inspect` | POST | Report watermark and metadata findings for a file |
| `/api/clean` | POST | Return the cleaned file bytes |
| `/api/rewrite` | POST | Optional model-backed prose or code rewrite |

`Model settings` in the top bar chooses local rules (default), a provider API
key, Ollama, or a custom OpenAI-compatible endpoint. Settings are stored in the
browser and only used when `Generate with model` is clicked. The tools work
without a key.

## Deploy

The repo is Vercel-ready. Static files serve from the root; the `/api` routes
are Python serverless functions in `api/` with no third-party dependencies.

```bash
vercel --prod
```

`vercel.json` maps `/api/inspect` to `api/scan.py` (the filename avoids
shadowing Python's stdlib `inspect` module) and bundles the vendored watermark
modules under `api/_wm/` into each function.

## What the slop detector checks

Both modes report a 0-100 score plus a per-axis breakdown. The axis points sum
to the score, so the breakdown is always the reason for the number.

**Text axes** (Phrasing, Structure, Rhythm, Substance, Vocabulary)

- Phrasing: cliche openers (including stacked-adjective forms like "in today's
  fast-paced digital landscape"), hype, stock AI phrases, importance puffery,
  superficial analysis, weasel attribution. Corporate verbs are matched in
  their inflected forms too (empower, empowers, empowering).
- Structure: rhetorical frames that stand in for an argument. Binary contrasts
  ("it is not X, it is Y"), throat-clearing openers, faux-insight setups, colon
  reveals, dramatic fragments, fake-profound endings, repeated tricolons.
- Rhythm: sentence-length variance, staccato fragmentation (runs of very
  short sentences), plus punctuation cadence. Punctuation fires on density,
  not on presence, so one em dash is not a flag.
- Substance: concrete detail density (numbers, names, dates) against abstract
  noun density.
- Vocabulary: corporate verbs, empty adjectives, lexical diversity, and synonym
  cycling (the same thing renamed mid-passage).

**Code axes** (Lies, Noise, Soul, Structure)

- Lies: placeholders, stubs, mutable default arguments, hedging comments,
  imports wired to nothing. A snippet that is mostly stubs is floored to a
  critical score regardless of its length.
- Noise: debug output, leftover TODOs, placeholder naming.
- Soul: comments promising more maturity than the logic shows.
- Structure: bare except, star imports, global state, ignored errors, and
  cross-language idiom leakage (JavaScript `.push()` in Python, Python `None`
  in JavaScript, Java `toString()` anywhere).

Language is detected per snippet so the cross-language table matches the file.

## The cleaner draft

The Cleaner draft tab produces an edited version of pasted prose with the local
rules only, no model required. It runs three passes:

1. Structural rewrites collapse whole frames. "It is not a tool. It is a
   philosophy." becomes "It is a philosophy." Throat-clearing openers, colon
   reveals, and dramatic fragments ("Full stop.") are deleted.
2. Phrase and word replacements swap stock AI vocabulary for plainer choices.
3. Synonym cycling is collapsed onto the term the writer used most, so an
   agent that becomes an assistant that becomes a copilot goes back to one name.

Where a frame carried no claim (an unsourced "experts agree", a bare "marks a
pivotal moment"), the cleaner removes it and lists the gap under the draft so
you can fill it with a real source, number, or before-and-after. The cleaner
never invents facts, so a draft with no concrete detail still scores on the
Substance axis after cleaning. That residue is the signal to add specifics
yourself. Cleaning is idempotent: running it twice gives the same text.

The cleaner works paragraph by paragraph, so threads and numbered lists keep
their structure. It also carries a hard guardrail: the draft is re-scored, and
if it is not strictly cleaner than the pasted text, the original is returned
unchanged with a note. The cleaner can never make a piece score worse than it
started.

Code is not auto-rewritten. A regex cannot safely edit logic, so code mode
returns a numbered repair plan instead of a draft.

## Scope

Use this only on files you own or are authorized to edit. The upstream project
cleans AI provenance metadata, C2PA/EXIF/XMP/document properties, invisible
Unicode marks, and related signals. This frontend does not implement visible
logo or copyright watermark inpainting.
