//Completion rules decide when a practice round ends. They return "won", "lost" or null (keep playing).

export function allSafeRevealed({ board }) {
  if (board.blasted) {
    return "lost";
  }
  return board.boardActions.checkWin() ? "won" : null;
}

//Ends the round once every "click" target is revealed, even if other safe tiles remain hidden.
export function targetsRevealed({ board, round }) {
  if (board.blasted) {
    return "lost";
  }

  const clickTargets = round.targets.filter((t) => t.kind === "click");
  const allRevealed = clickTargets.every(
    (t) => typeof board.tilesArray[t.x][t.y].state === "number"
  );

  return allRevealed ? "won" : null;
}
