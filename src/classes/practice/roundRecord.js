/*
  A round record is a plain serialisable object describing one practice round.
  It is built in memory only. A future game-history system can adopt it as is.

  Times inside a round (clicks, moves, button events, board events, endTime) are seconds relative
  to that round's own reveal (time 0), so metrics don't depend on the rest of the set.
  Events from the countdown are negative.

  A whole set exports as one continuous game, so each round also records where it sits on the
  game clock (seconds, with 0 = the first round's reveal):
    revealOffset       when this round's board was revealed
    boardHiddenOffset  when the previous board was cleared to make way for this round (null on round 1)
    generatedOffset    when this round's mines were chosen (null on round 1)
  Export puts a round's event on the game clock by adding revealOffset to its time.

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
  boardHiddenOffset = null,
  generatedOffset = null,
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
    revealOffset: 0,
    boardHiddenOffset,
    generatedOffset,
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
  //Deliberately the same array: while the next round is being set up, mouse movement keeps being
  //appended here (still on this round's clock) so the exported game has no gaps in the cursor path
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
