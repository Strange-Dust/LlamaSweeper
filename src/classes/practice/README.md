# Practice framework

The **Practice** variant (`/game/practice`) runs training scenarios on the normal board. Gameplay is plain minesweeper. A scenario only controls the mine layout, the starting reveal state, how rounds start, when a round ends, and what goes on the scorecard.

Scenario logic belongs in this folder. `Board`, `BoardInput`, `BoardActions` and `BoardRenderer` only have small hooks that run when the variant is `"practice"`.

## Adding a scenario

1. Create a definition in `scenarios/` (plain data, see `scenarios/flick.js`).
2. Register it in `index.js` with `PracticeRegistry.registerScenario(...)`.

If the scenario needs new behaviour, add a building block and register it in `index.js`:

| Block           | Folder        | Contract                                                                                                                            |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Generator       | `generators/` | `({ width, height, params, rng }) => { mines, initialTiles, targets, meta }`                                                        |
| Completion rule | `completion/` | `({ board, round, params }) => "won" \| "lost" \| null`                                                                             |
| Metric          | `metrics/`    | `{ id, label, unit, better, description, compute(roundRecord, params) => number \| null }` (`description` is the scorecard tooltip) |

Grids use `grid[tileX][tileY]`. `initialTiles` values are tile states: a number (revealed), `CONSTANTS.UNREVEALED` or `CONSTANTS.FLAG`. `validateGeneratedBoard` rejects boards where a revealed `0` touches a hidden safe tile, because chording that zero would open the tile.

## Definition shape

```js
{
  id, version, name, category, description,
  board: { allowUserSize, minWidth, minHeight } | { width, height },
  generator: { type, params },
  rounds,                                  // 1 = single round, N = a set
  start: { first: StartStyle, between: StartStyle },
  completion: { type, params },            // default "all-safe-revealed"
  onMine: "lose" | "continue",             // continue = hit mine becomes a flag + penalty
  metrics: [{ type, params, key?, label? }],
  rawvfMode,                               // "Mode:" line in RawVF exports
  options: [OptionSchema],                 // rendered automatically in the config bar
  hooks: { onRoundStart, onRoundEnd },     // optional code escape hatch (not serialisable)
}

StartStyle = {
  trigger: "button" | "auto",              // centre start button, or start automatically
  holdMs, holdAfterLossMs,                 // how long the finished board stays visible
  timing: { countdown: seconds, delay: ms | { min, max } },  // countdown shown first, then a silent delay
}
```

Any value can be `{ $option: "key" }` to use the user's choice for that option. A select choice can include `resolved` (any data, such as a whole `StartStyle`), which is substituted in place of the stored `value`. Option values are persisted per `id@vversion`, so bumping `version` discards stale saved values.

## Round lifecycle and data

`gameStage` goes `practice-armed` → `practice-countdown` → `running` → `won`/`lost`, and then either the next round or the end of the set. Time 0 is the moment the board is revealed, so input during the countdown has negative timestamps.

Each round produces a serialisable round record (`roundRecord.js`) containing the clicks, moves, button events, board events and metrics. The scorecard is shown once the whole set is complete. Records are held in memory only. RawVF export (`RawVF.createPracticeRawVfText`) writes one section per round, with full board events.
