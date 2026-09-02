# Bug report — PlayPage code review (2026-08-31)

Scope: all of `src/classes` (except the wasm folder), `src/workers`, `src/composables/useSettings.js`, `PlayPage.vue` and the components/modals it uses. Every candidate finding was verified against the actual code before being included; things that looked like bugs but turned out to be intentional are listed at the bottom so they don't get "fixed" by mistake.

---

## Confirmed bugs

### 1. `addRecentlyPlayedCustom` never excludes expert-sized boards (copy-paste duplicate)

- **File:** `src/classes/EffShuffleManager.js`, lines ~471–479
- **Confidence:** high

```js
//exclude games of regular sizes.
if (boardKey.startsWith("9-9-10-")) {
  return;
}
if (boardKey.startsWith("16-16-40-")) {
  return;
}
if (boardKey.startsWith("16-16-40-")) {
  // <-- duplicate of the line above
  return;
}
```

The third check repeats the intermediate size instead of checking expert. Compare with `garbageCollect()` (lines ~414–446), which correctly treats `"30-16-99-"` and `"16-30-99-"` as the expert prefixes.

**Effect:** expert-size eff boards get pushed into `recentlyPlayedCustoms` (a queue capped at `maxStoredCustoms = 10`) even though standard sizes are supposed to be excluded. This (a) evicts genuinely custom board keys from the queue sooner, so a recently played custom config can lose its garbage-collection protection and have its pre-generated boards deleted, and (b) gives expert boards with low/non-preset target efficiencies GC protection they were not meant to have.

**Fix outline:** change the duplicated condition to:

```js
if (boardKey.startsWith("30-16-99-") || boardKey.startsWith("16-30-99-")) {
  return;
}
```

### 2. `Board.updateForQueryChange` uses an undeclared variable `expectedQuery`

- **File:** `src/classes/Board.js`, lines ~884–891
- **Confidence:** high (defect), but currently **dead code** — nothing calls this method (the URL watcher uses `updateForUrlChange` instead), so there is no user impact today.

```js
updateForQueryChange(newQuery) {
  if (Utils.shallowObjectEquals(newQuery, expectedQuery)) {  // ReferenceError if ever called
    return;
  }
  expectedQuery = newQuery;
  ...
}
```

`expectedQuery` is neither a local variable nor a class property. ES modules are strict mode, so the first call would throw `ReferenceError: expectedQuery is not defined`.

**Fix outline:** either delete the method, or declare `this.expectedQuery = null;` in the constructor and use `this.expectedQuery` in both places.

---

## Dead / WIP code that will crash if ever called (no current user impact)

These are unreachable today but are landmines for future work.

### 3. `ChainZini.getConsiderableChordsImproved` always throws

- **File:** `src/classes/ChainZini.js`, line ~2158

An unconditional `throw new Error('TODO - Filter out chords that are equivalent to clicking an opening')` sits directly above `considerableChords.push({ x, y })`, so any call that reaches a considerable square throws. The function is currently uncalled, and `notes/todo.md` acknowledges it as WIP ("Make progress on getConsiderableChordsImproved"). No action needed unless it gets wired up; then remove the throw (the filtering it refers to appears to already be implemented above it).

### 4. `ChainZini.analyseResultsAverageOld2` reads a field that is never populated

- **File:** `src/classes/ChainZini.js`, line ~2223

It reduces `results.zinisExcluded`, but the only code that sets `zinisExcluded` is inside an `if (false)` block (~lines 1873–1900, disabled for performance). Calling this function would throw `Cannot read properties of undefined (reading 'reduce')`. It is uncalled (superseded "Old2" variant). Fix outline: delete the function, or have it fall back when `zinisExcluded` is absent.

---

## Minor

### 5. Leftover debug log

- **File:** `src/pages/PlayPage.vue`, line 346

`console.log("refresh called");` inside the debounced `addCallbackWhenSingleImageLoaded` callback logs to the console on every image load batch (e.g. on skin change). Fix: delete the line.

---

## Investigated and ruled out (do NOT "fix" these)

Recorded so a future pass doesn't mistake them for bugs:

- **QuickPaint counts ignore "green"** (`QuickPaint.js`): correct — `redCount` counts unaccounted mines; green marks _safe_ squares and should not affect it. The click handlers and `refreshQuickPaintCounts` are consistent with each other.
- **`BoardHint.js` ~line 343 sets a numeric `hintTexture`**: correct — numeric keys (0–8) are valid `skinManager.getImage` keys (the regular number tiles), and the `"textureonly"` render mode intentionally draws the full number texture over an already-revealed number whose value changed due to removed mean mines. The `"tr2_" + n` case nearby serves a different (transparent) purpose.
- **`SkinManager` priority paths for `"transparent2"` push `/tiles_transparent/`**: correct — the _style_ named `transparent2` renders with `tr_` numbers + `cl_mine` (see `Board.populateHiddenNumbers`); the style that uses the `/tiles_transparent2/` images is `transparent3`.
- **`eff-worker.js` rejects `firstClickType === "same"`** and defaults it to random: intentional — the Eff Boards config UI states background-generated boards ignore the "Mouse" option.
- **Mean openings win/`openedTiles` accounting**: zeros are counted as opened before being converted to mean mines, and never re-counted; totals balance because each mean mine sits on a formerly-safe tile counted exactly once, so `checkWin()` remains reachable.
- **`chord()` can blast a mean mine under "Ignore clicks"**: the option labels distinguish `Ignore clicks` from `Ignore + chordable`, so chords being unprotected under plain "ignore" is the documented difference between the two settings.
- **Template writes like `replayType = val` in PlayPage inline handlers**: valid Vue 3 — the render-context proxy assigns to `.value` for top-level script-setup refs.
- **`Replay.forwardSearchForClickIndexlerped` early-time boundary**: the game timer starts on the first click, so `clicks[0].time ≈ 0`; the alleged gap `[0, firstClickTime)` cannot occur.
- **`Chain.cloneChain` shallow-copies `positionIfUnchordedDig`**: safe — every write site _reassigns_ the property (fresh object or `false`); the object is never mutated in place.
- **`ziniExplore.refreshForEditedBoard` not killing the DeepChain runner**: both callers (`Board.resetBoard`, `Board.switchToAnalyseMode`) kill the runner immediately before calling it.
- **`DeepChainRunnerPanel` cancelling via `ziniExplore.killDeepChainZiniRunner()`**: correct — the panel only renders when `variant === 'zini explorer'`, whose runs are owned by `ZiniExplore`; `StatsPanel` separately cancels the stats-owned runner.
- **`lrChordingState.hoverType === "empty"` guards**: not dead — `"empty"` is assigned in `BoardActions.js` line 157 after a chord executes.
- **PlayPage `skinManager.addCallback*` on every mount**: not a leak — SkinManager stores a single callback per slot, so remounting overwrites rather than accumulates.
