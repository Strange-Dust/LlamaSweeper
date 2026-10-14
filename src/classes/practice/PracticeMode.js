import { markRaw } from "vue";
import { Dialog } from "quasar";

import CONSTANTS from "src/includes/Constants";
import BoardStats from "src/classes/BoardStats";
import statsWorkerManager from "src/classes/StatsWorkerManager";

import { PracticeRegistry } from "./index";
import { resolveScenario } from "./resolveScenario";
import { computeMetrics, summariseRounds } from "./metrics/metricResults";
import { createRng, randomSeed } from "./rng";
import { validateGeneratedBoard } from "./generators/boardUtils";
import {
  createRoundRecord,
  finaliseRoundRecord,
  snapshotStates,
  shiftStatsTimes,
} from "./roundRecord";
import {
  getSelectedScenarioDefinition,
  getSelectedOptionValues,
  getPracticeBoardSize,
} from "./practiceSelection";

import {
  boardHorizontalPadding,
  boardTopPadding,
  chordingButtons,
  mobileModeEnabled,
  practiceResults,
} from "src/composables/useSettings";

/*
  Runs the practice variant's round lifecycle on top of the normal Board.

  gameStage flow:
    "practice-armed"     board hidden, start button drawn in the centre
    "practice-countdown" board hidden, countdown/delay running, mouse movement recorded at negative time
    "running"            scenario's starting state revealed, time 0 is the reveal
    "won" / "lost"       round over; next round starts per the scenario's between-round start style

  Scenario-specific behaviour lives in scenario definitions and registered building blocks,
  not here and not in Board/BoardInput/BoardActions.
*/

function resolveDelay(delay) {
  if (typeof delay === "number") {
    return delay;
  }
  return delay.min + Math.random() * (delay.max - delay.min);
}

class PracticeMode {
  constructor(board) {
    this.board = board;

    this.timerHandles = new Set();
    this.scenario = null; //Resolved scenario for the current set
    this.completedRounds = [];
    this.currentRound = null;
    this.shadowStates = null; //Tile states at the last capture, used to derive board events
    this.countdownValue = null; //Number drawn over the board, null for none
    this.setComplete = false;
  }

  // ########## Lifecycle ##########

  //Called on every board reset regardless of variant
  cancel() {
    this.clearTimers();
    this.countdownValue = null;
    this.currentRound = null;
    this.shadowStates = null;
  }

  //Called by Board.resetBoard for the practice variant. Returns the board size to use.
  prepareSet() {
    this.cancel();
    this.completedRounds = [];
    this.setComplete = false;
    this.scenario = null;

    const definition = getSelectedScenarioDefinition();
    try {
      this.scenario = resolveScenario(
        definition,
        getSelectedOptionValues(definition)
      );
    } catch (error) {
      console.error(error);
      Dialog.create({
        title: "Practice scenario error",
        message: error.message,
      });
    }

    this.publishResults();

    if (!this.scenario) {
      return { width: 9, height: 9 };
    }
    return getPracticeBoardSize(this.scenario.board);
  }

  arm() {
    const board = this.board;
    this.clearTimers();
    this.countdownValue = null;
    board.resetTiles();
    board.unflagged = 0;
    board.integerTimer = 0;
    board.gameStage = "practice-armed";
    board.boardInput.resetInteractionState();
    board.boardRenderer.draw();
  }

  beginRound() {
    this.clearTimers();

    const board = this.board;
    const scenario = this.scenario;
    const roundIndex = this.completedRounds.length;
    const style =
      roundIndex === 0 ? scenario.start.first : scenario.start.between;
    const seed = randomSeed();

    let generated;
    try {
      const generator = PracticeRegistry.getGenerator(scenario.generator.type);
      generated = generator({
        width: board.width,
        height: board.height,
        params: scenario.generator.params,
        rng: createRng(seed),
      });
      validateGeneratedBoard(generated, board.width, board.height);
    } catch (error) {
      console.error(error);
      Dialog.create({
        title: "Practice board generation failed",
        message: error.message,
      });
      this.arm();
      return;
    }

    board.mines = generated.mines;
    board.mineCount = generated.mines.flat().filter(Boolean).length;
    board.unflagged = board.mineCount;
    board.openedTiles = 0;
    board.blasted = false;
    board.resetTiles();
    board.boardInput.resetInteractionState();
    board.boardHint.lastSquaresChangedForAutoHint = [];

    statsWorkerManager.incrementStatsLock();
    board.stats = new BoardStats(generated.mines, statsWorkerManager);
    board.stats.addVariantAttribute("practice");
    const superClick = chordingButtons.value === "l";
    if (superClick) {
      board.stats.addSuperClickAttribute();
    }

    this.currentRound = createRoundRecord({
      scenario,
      index: roundIndex,
      seed,
      width: board.width,
      height: board.height,
      generated,
      superClick,
    });
    scenario.hooks.onRoundStart?.({
      board,
      round: this.currentRound,
      scenario,
    });

    const countdownSeconds = style.timing.countdown;
    const waitMs = countdownSeconds * 1000 + resolveDelay(style.timing.delay);

    board.boardRenderer.clearTimerTimeout();
    board.integerTimer = 0;
    //Time 0 is the planned reveal, so input during the countdown is recorded at negative time
    board.boardStartTime = performance.now() + waitMs;
    board.gameStage = "practice-countdown";

    if (waitMs <= 0) {
      this.reveal();
      return;
    }

    this.countdownValue = countdownSeconds > 0 ? countdownSeconds : null;
    for (let elapsed = 1; elapsed <= countdownSeconds; elapsed++) {
      this.setTimer(() => {
        this.countdownValue =
          elapsed < countdownSeconds ? countdownSeconds - elapsed : null;
        board.boardRenderer.draw();
      }, elapsed * 1000);
    }
    this.setTimer(() => this.reveal(), waitMs);

    board.boardRenderer.draw();
  }

  reveal() {
    const board = this.board;
    const round = this.currentRound;
    if (!round || board.gameStage !== "practice-countdown") {
      return;
    }

    const now = performance.now();
    const lateBySeconds = (now - board.boardStartTime) / 1000;
    if (lateBySeconds > 0) {
      shiftStatsTimes(board.stats, -lateBySeconds);
    }
    board.boardStartTime = now;
    this.countdownValue = null;

    for (let x = 0; x < board.width; x++) {
      for (let y = 0; y < board.height; y++) {
        const state = round.initialTiles[x][y];
        board.tilesArray[x][y].state = state;
        if (typeof state === "number") {
          board.openedTiles++;
        } else if (state === CONSTANTS.FLAG) {
          board.unflagged--;
        }
      }
    }

    round.inputType = mobileModeEnabled.value ? "touch" : "mouse";
    round.startCursor = this.getCursorTilePosition();
    this.shadowStates = snapshotStates(board.tilesArray);

    board.gameStage = "running";
    board.boardRenderer.updateTimerSetTimeoutHandle = setTimeout(
      board.boardRenderer.updateIntegerTimerIfNeeded.bind(board.boardRenderer),
      100
    );
    board.boardRenderer.draw();
  }

  //Called by BoardActions.doWin/doLose
  handleRoundEnd(isWin) {
    const board = this.board;
    const round = this.currentRound;
    if (!round) {
      return;
    }

    this.currentRound = null;
    this.shadowStates = null;

    finaliseRoundRecord(round, board.stats, isWin);
    this.scenario.hooks.onRoundEnd?.({ board, round, scenario: this.scenario });
    round.metrics = computeMetrics(this.scenario.metrics, round);

    this.completedRounds.push(markRaw(round));
    this.setComplete = this.completedRounds.length >= this.scenario.rounds;
    this.publishResults();

    if (this.setComplete) {
      board.boardActions.flagToggleShowReset(450);
      return;
    }

    const between = this.scenario.start.between;
    const holdMs = isWin
      ? between.holdMs
      : Math.max(between.holdMs, between.holdAfterLossMs);
    this.setTimer(() => {
      if (between.trigger === "button") {
        this.arm();
      } else {
        this.beginRound();
      }
    }, holdMs);
  }

  // ########## Input ##########

  //Board input while the board is hidden. Only the start button does anything.
  handlePreRoundInput({
    isDigInput,
    isFlagInput,
    isTouchInput,
    isDown,
    coordsData,
    touchIdentifier,
  }) {
    if (this.board.gameStage === "practice-countdown") {
      //Keep presses during the countdown (e.g. false starts) for analysis
      if (
        touchIdentifier === "mouse" &&
        (isDigInput || isFlagInput) &&
        this.board.stats
      ) {
        this.board.stats.addButtonEvent(
          isDigInput ? "left" : "right",
          isDown,
          coordsData.unflooredCoords.tileX,
          coordsData.unflooredCoords.tileY,
          this.board.getTime()
        );
      }
      return;
    }

    const isRelease = !isDown && (isDigInput || (isTouchInput && isFlagInput));
    if (!isRelease || !this.scenario) {
      return;
    }

    if (this.isInStartButton(coordsData.canvasCoords)) {
      this.beginRound();
    }
  }

  //Called after every board input while a practice round is running
  processBoardInput(needToCheckForEnd) {
    const board = this.board;

    if (
      needToCheckForEnd &&
      board.blasted &&
      this.scenario.onMine === "continue"
    ) {
      this.absorbBlast();
    }

    this.captureBoardEvents();

    if (!needToCheckForEnd) {
      return;
    }

    const rule = PracticeRegistry.getCompletionRule(
      this.scenario.completion.type
    );
    const outcome = rule({
      board,
      round: this.currentRound,
      params: this.scenario.completion.params,
    });

    if (outcome === "lost") {
      board.boardActions.doLose();
    } else if (outcome === "won") {
      board.boardActions.doWin();
    }
  }

  //onMine: "continue" turns hit mines into flags and records a penalty instead of ending the round
  absorbBlast() {
    const board = this.board;
    const time = board.getTime();
    for (let x = 0; x < board.width; x++) {
      for (let y = 0; y < board.height; y++) {
        if (board.tilesArray[x][y].state === CONSTANTS.MINERED) {
          board.tilesArray[x][y].state = CONSTANTS.FLAG;
          board.unflagged--;
          this.currentRound.penalties.push({ time, x, y });
        }
      }
    }
    board.blasted = false;
  }

  captureBoardEvents() {
    const round = this.currentRound;
    if (!round || !this.shadowStates) {
      return;
    }

    const time = this.board.getTime();
    const tilesArray = this.board.tilesArray;
    for (let x = 0; x < this.board.width; x++) {
      for (let y = 0; y < this.board.height; y++) {
        const state = tilesArray[x][y].state;
        if (state !== this.shadowStates[x][y]) {
          round.boardEvents.push({ time, x, y, state });
          this.shadowStates[x][y] = state;
        }
      }
    }
  }

  getCursorTilePosition() {
    if (mobileModeEnabled.value) {
      return null;
    }
    const { tileX, tileY } = this.board.boardInput.eventToUnflooredTileCoords(
      this.board.boardInput.lastClientCoords
    );
    return { x: tileX, y: tileY };
  }

  // ########## Rendering support ##########

  getStartButtonRect() {
    const tileSize = this.board.tileSize;
    const boardPixelWidth = this.board.width * tileSize;
    const boardPixelHeight = this.board.height * tileSize;
    const width = Math.min(boardPixelWidth, tileSize * 4);
    const height = Math.min(boardPixelHeight, tileSize * 1.5);

    return {
      x: boardHorizontalPadding.value + (boardPixelWidth - width) / 2,
      y: boardTopPadding.value + (boardPixelHeight - height) / 2,
      width,
      height,
    };
  }

  isInStartButton(canvasCoords) {
    const rect = this.getStartButtonRect();
    return (
      canvasCoords.canvasRawX >= rect.x &&
      canvasCoords.canvasRawX <= rect.x + rect.width &&
      canvasCoords.canvasRawY >= rect.y &&
      canvasCoords.canvasRawY <= rect.y + rect.height
    );
  }

  getOverlay() {
    if (this.board.gameStage === "practice-armed" && this.scenario) {
      const total = this.scenario.rounds;
      return {
        type: "start",
        rect: this.getStartButtonRect(),
        caption:
          total > 1
            ? `Round ${this.completedRounds.length + 1} / ${total}`
            : null,
      };
    }
    if (
      this.board.gameStage === "practice-countdown" &&
      this.countdownValue !== null
    ) {
      return { type: "countdown", value: this.countdownValue };
    }
    return null;
  }

  // ########## Results ##########

  getCompletedRounds() {
    return this.completedRounds;
  }

  publishResults() {
    const rounds = this.completedRounds.map((round) => ({
      index: round.index,
      outcome: round.outcome,
      penalties: round.penalties.length,
      metrics: round.metrics,
    }));

    practiceResults.value = {
      scenarioName: this.scenario?.name ?? "",
      totalRounds: this.scenario?.rounds ?? 0,
      rounds,
      summary: rounds.length > 0 ? summariseRounds(rounds) : null,
      complete: this.setComplete,
    };
  }

  // ########## Timers ##########

  setTimer(callback, delayMs) {
    const handle = setTimeout(() => {
      this.timerHandles.delete(handle);
      callback();
    }, delayMs);
    this.timerHandles.add(handle);
  }

  clearTimers() {
    for (const handle of this.timerHandles) {
      clearTimeout(handle);
    }
    this.timerHandles.clear();
  }
}

export default PracticeMode;
