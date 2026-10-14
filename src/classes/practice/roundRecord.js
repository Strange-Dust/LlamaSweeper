/*
  A round record is a plain serialisable object describing one practice round.
  It is built in memory only. A future game-history system can adopt it as is.

  Times are seconds relative to the board reveal (time 0). Events from the countdown are negative.
  boardEvents are tile state changes caused by the player: { time, x, y, state }.
*/

export function createRoundRecord({
  scenario,
  index,
  seed,
  width,
  height,
  generated,
  superClick,
}) {
  return {
    scenarioId: scenario.id,
    scenarioVersion: scenario.version ?? 1,
    scenarioName: scenario.name,
    rawvfMode: scenario.rawvfMode ?? `Practice: ${scenario.name}`,
    optionValues: { ...scenario.optionValues },
    index,
    seed,
    width,
    height,
    mines: generated.mines,
    initialTiles: generated.initialTiles,
    targets: generated.targets ?? [],
    meta: generated.meta ?? {},
    superClick,
    inputType: null,
    startCursor: null,
    boardEvents: [],
    penalties: [],
    clicks: [],
    moves: [],
    buttonEvents: [],
    outcome: null,
    endTime: null,
    metrics: [],
  };
}

export function finaliseRoundRecord(round, stats, isWin) {
  round.outcome = isWin ? "won" : "lost";
  round.endTime = stats.endTime;
  round.clicks = stats.clicks;
  round.moves = stats.moves;
  round.buttonEvents = stats.buttonEvents;
}

export function snapshotStates(tilesArray) {
  return tilesArray.map((column) => column.map((tile) => tile.state));
}

//Rebase times recorded during the countdown when the reveal timer fires late
export function shiftStatsTimes(stats, deltaSeconds) {
  for (const list of [stats.clicks, stats.moves, stats.buttonEvents]) {
    for (const entry of list) {
      entry.time += deltaSeconds;
    }
  }
}
