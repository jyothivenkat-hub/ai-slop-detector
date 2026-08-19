# AI Slop and Watermark Tools

This workspace contains the AI slop detector as the first page and a frontend
page for your fork of the MIT-licensed
[`watermarks-remover`](https://github.com/jyothivenkat-hub/watermarks-remover)
service cloned into `vendor/watermarks-remover`.

Upstream attribution:
[`guillaumemeyer/watermarks-remover`](https://github.com/guillaumemeyer/watermarks-remover).

## Run

```bash
python3 server.py
```

Open `http://127.0.0.1:8020/` for the AI slop detector.

Open `http://127.0.0.1:8020/watermark.html` for the watermark remover. It
supports pasted text and file uploads.

Use `Model settings` in the top bar to choose local rules, a provider API key,
Ollama, or a custom OpenAI-compatible endpoint. These settings are saved in the
browser for this local app and used only when `Generate with model` is clicked
in the cleaner tab. The current tools still work without a key.

The local server starts the fork-backed stdlib Python service on `127.0.0.1:8767`
and proxies:

- `GET /api/health`
- `GET /api/capabilities`
- `POST /api/inspect`
- `POST /api/clean`
- `POST /api/rewrite`

## What the slop detector checks

Both modes report a 0-100 score plus a per-axis breakdown. The axis points sum
to the score, so the breakdown is always the reason for the number.

**Text axes** (Phrasing, Structure, Rhythm, Substance, Vocabulary)

- Phrasing: cliche openers, hype, stock AI phrases, importance puffery,
  superficial analysis, weasel attribution.
- Structure: rhetorical frames that stand in for an argument. Binary contrasts
  ("it is not X, it is Y"), throat-clearing openers, faux-insight setups, colon
  reveals, dramatic fragments, fake-profound endings, repeated tricolons.
- Rhythm: sentence-length variance plus punctuation cadence. Punctuation fires
  on density, not on presence, so one em dash is not a flag.
- Substance: concrete detail density (numbers, names, dates) against abstract
  noun density.
- Vocabulary: corporate verbs, empty adjectives, lexical diversity, and synonym
  cycling (the same thing renamed mid-passage).

**Code axes** (Lies, Noise, Soul, Structure)

- Lies: placeholders, stubs, hedging comments, imports wired to nothing.
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

Code is not auto-rewritten. A regex cannot safely edit logic, so code mode
returns a numbered repair plan instead of a draft.

## Credits for the checks

- Four-axis code scoring and cross-language leakage:
  [rsionnach/sloppylint](https://github.com/rsionnach/sloppylint)
- Structural prose patterns:
  [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop)
- Multi-dimension scoring rubric:
  [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop)
- Code-mode LDR/ICR/DDC/purity framing:
  [flamehaven01/AI-SLOP-Detector](https://github.com/flamehaven01/AI-SLOP-Detector)

## Scope

Use this only on files you own or are authorized to edit. The upstream project
cleans AI provenance metadata, C2PA/EXIF/XMP/document properties, invisible
Unicode marks, and related signals. This frontend does not implement visible
logo or copyright watermark inpainting.
