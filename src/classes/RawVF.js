import { exportFile } from "quasar";
import Utils from "./Utils.js";
import CONSTANTS from "src/includes/Constants";
import { recordButtonEvents } from "src/composables/useSettings";

const RAWVF_SQUARE_SIZE = 64; //Keep this high to make things smoother even though real square size may differ

class RawVF {
  constructor() {
    throw new Error(
      "RawVF class only has static methods, and cannot be instantiated"
    );
  }

  static createRawVfText(boardStats) {
    const boardWidth = boardStats.mines.length;
    const boardHeight = boardStats.mines[0].length;

    const isSuperClick = boardStats.attributes.superClick;

    let rawVfText = "";

    let description = "";
    description += "RawVF_Version: Rev6.2\n";
    description += "Program: LlamaSweeper\n";
    //description += "Player: Anon\n"
    //description += "Timestamp: 2026-02-24T01:13:18.825Z\n"
    description += `Level: ${this.getLevelFromSize(boardStats)}\n`;
    description += `Width: ${boardWidth}\n`;
    description += `Height: ${boardHeight}\n`;
    description += `Mines: ${
      boardStats.mines.flat().filter((s) => s).length
    }\n`;
    description += "Marks: Off\n";
    description += `SuperClick: ${isSuperClick ? "On" : "Off"}\n`;
    description += `SquareSize: ${RAWVF_SQUARE_SIZE}\n`; //May differ from real square size
    description += `Time: ${boardStats.endTime.toFixed(3)}\n`;
    description += `Status: ${boardStats.isWin ? "won" : "loss"}\n`;
    description += `Mode: ${this.getDescriptionMode(boardStats)}\n`;

    rawVfText += description;

    let board = "Board:\n";

    for (let y = 0; y < boardHeight; y++) {
      let row = "";

      for (let x = 0; x < boardWidth; x++) {
        if (boardStats.mines[x][y]) {
          row += "*";
        } else {
          row += "0";
        }
      }

      board += row + "\n";
    }

    rawVfText += board;

    let events = "Events:\n";

    let clicksIndex = 0;
    let movesIndex = 0;

    //Touch games have no raw button events, so fall back to paired clicks
    const useButtonEvents =
      recordButtonEvents.value && boardStats.buttonEvents.length > 0;
    const clicks = useButtonEvents
      ? boardStats.buttonEvents
      : boardStats.clicks;
    const moves = boardStats.moves;

    //Since llamasweeper tracks clicks and moves separately we iterate through both together taking the earlier timestamped event from each
    //Although in hindsight it might just be simpler to merge arrays and sort...
    while (clicksIndex < clicks.length || movesIndex < moves.length) {
      let maybeClick = clicks[clicksIndex]; //may be undefined
      let maybeMove = moves[movesIndex]; //may be undefined

      if (
        (maybeClick && !maybeClick.hasOwnProperty("time")) ||
        (maybeMove && !maybeMove.hasOwnProperty("time"))
      ) {
        throw new Error("click/move data missing time property");
      }

      let clickNext; //Whether the earliest time stamp is from the next click or next chord
      if (maybeClick && maybeMove) {
        clickNext = maybeClick.time < maybeMove.time;
      } else if (maybeClick) {
        clickNext = true;
      } else if (maybeMove) {
        clickNext = false;
      } else {
        throw new Error("Should never happen");
      }

      if (clickNext) {
        //Take the current click and increment
        events += useButtonEvents
          ? this.getButtonEventLine(maybeClick, boardWidth, boardHeight)
          : this.getMouseClickEventLine(
              maybeClick,
              boardWidth,
              boardHeight,
              isSuperClick
            );
        clicksIndex++;
      } else {
        events += this.getMouseMoveEventLine(
          maybeMove,
          boardWidth,
          boardHeight
        );
        movesIndex++;
      }
    }

    rawVfText += events;

    return rawVfText;
  }

  static downloadRawVf(boardStats) {
    let rawVfText = this.createRawVfText(boardStats);

    const fileName = this.createFileName(boardStats);

    exportFile(fileName, rawVfText);
  }

  static sendToStrangeDust(boardStats) {
    let rawVfText = this.createRawVfText(boardStats);

    const replayFileName = this.createFileName(boardStats);

    this.sendRawVfTextToStrangeDust(rawVfText, replayFileName);
  }

  static sendRawVfTextToStrangeDust(rawVfText, replayFileName) {
    if (!("TextEncoder" in window)) {
      alert("Sorry, this browser does not support TextEncoder...");
      throw new Error("TextEncoder unavailable");
    }
    var enc = new TextEncoder();
    const replayBuffer = enc.encode(rawVfText).buffer;

    //Wait for ready signal
    const onMessage = (event) => {
      if (event.origin !== "https://strange-dust.github.io") {
        return;
      }

      if (event.data?.type === "replay-analyzer-ready") {
        analyzerWindow.postMessage(
          {
            type: "replay-analyzer-load",
            buffer: replayBuffer,
            filename: replayFileName,
          },
          "https://strange-dust.github.io"
        );
        window.removeEventListener("message", onMessage);
      }
    };

    window.addEventListener("message", onMessage);

    //Open analyser in a new tab
    const analyzerWindow = window.open(
      "https://strange-dust.github.io/minesweeper-replay-analyzer/",
      "_blank"
    );

    if (!analyzerWindow) {
      //Possibly popup blocked?
      window.removeEventListener("message", onMessage);
      return;
    }
  }

  static getLevelFromSize(boardStats) {
    let width = boardStats.mines.length;
    let height = boardStats.mines[0].length;

    switch (`${width}x${height}`) {
      case "9x9":
        return "Beginner";
      case "16x16":
        return "Intermediate";
      case "30x16":
        return "Expert";
      default:
        return "Custom";
    }
  }

  static getDescriptionMode(boardStats) {
    /*
      For the `Mode: Classic` line in the RawVF description header
      According to docs it should be one of
      classic/lucky/density/upk/cheat
      but I will see if I can get away with using arbitrary text
    */

    const noGuess = boardStats.attributes.noGuess;
    const hintsUsed = boardStats.attributes.hintsUsed;
    const variant = boardStats.attributes.variant;

    let mode = "Classic";

    if (variant === "normal") {
      mode = "Classic";
      if (noGuess) {
        mode = "Classic NG";
      }
      if (hintsUsed) {
        mode = "Cheat (hinted)"; //It's deliberate that this replaces NG as it's a stronger condition
      }
    } else if (variant === "board editor") {
      mode = "Upk";
    } else if (variant === "eff boards") {
      mode = "Eff Boards";
      if (hintsUsed) {
        mode = "Cheat (hinted)";
      }
    }

    return mode;
  }

  /*
    relevant bit of spec
    <mouse_event> ::= <elapsed_time> <mouse_event_id> [column] [row] (<coord_x> <coord_y>) [(<mouse_state>)]\n
    <elapsed_time> ::= <second>.<hundredth> | <second>.<thousandth> | -<second>.<hundredth> | -<second>.<thousandth>
    <mouse_event_id> ::= <left_click> | <left_release> | <right_click> | <right_release> | <middle_click> | <middle_release> | <mouse_move> | <left_click_with_shift> | <toggle_question_mark_setting>
    <left_click> ::= lc
    <left_release> ::= lr
    <right_click> ::= rc
    <right_release> ::= rr
    <middle_click> ::= mc
    <middle_release> ::= mr
    <mouse_move> ::= mv
    <left_click_with_shift> ::= sc
    <toggle_question_mark_setting> ::= mt
    <mouse_state> ::= [<left_pressed>][<right_pressed>][<middle_pressed>]
    <left_pressed> ::= l
    <right_pressed> ::= r
    <middle_pressed> ::= m
  */
  static getMouseClickEventLine(click, boardWidth, boardHeight, isSuperClick) {
    const elapsedTime = click.time.toFixed(3);

    //Our click events map to multiple rawVF events because we don't store mouseup/down currently
    const typeMap = {
      left: ["lc", "lr"],
      wasted_left: ["lc", "lr"],
      chord: isSuperClick ? ["lc", "lr"] : ["mc", "mr"], //Send chords as left click for l-chord and middle for l+r (this preserves properties of each, as we've had bugs before where l+r was sent as left and then blasted on top of mines instead of protecting)
      wasted_chord: isSuperClick ? ["lc", "lr"] : ["mc", "mr"],
      right: ["rc", "rr"],
      wasted_right: ["rc", "rr"],
    };

    if (!typeMap.hasOwnProperty(click.type)) {
      throw new Error("Unexpected click type");
    }

    const eventId = typeMap[click.type];

    //Cell coordinates in RawVF are 1-based (pixel coordinates are 0-based)
    const col = Utils.clamp(click.x, 0, boardWidth - 1) + 1;
    const row = Utils.clamp(click.y, 0, boardHeight - 1) + 1;

    const coordX = Utils.clamp(
      Math.floor(click.xRaw * RAWVF_SQUARE_SIZE),
      0,
      boardWidth * RAWVF_SQUARE_SIZE - 1
    );
    const coordY = Utils.clamp(
      Math.floor(click.yRaw * RAWVF_SQUARE_SIZE),
      0,
      boardHeight * RAWVF_SQUARE_SIZE - 1
    );

    let event = "";
    event += `${elapsedTime} ${eventId[0]} ${col} ${row} (${coordX} ${coordY})\n`;
    event += `${elapsedTime} ${eventId[1]} ${col} ${row} (${coordX} ${coordY})\n`;

    return event;
  }

  //RawVF cell coordinates are 1-based, and 0 means off the grid
  static toCellCoordinate(tileIndex, size) {
    return tileIndex >= 0 && tileIndex < size ? tileIndex + 1 : 0;
  }

  static getButtonEventLine(buttonEvent, boardWidth, boardHeight) {
    const typeMap = {
      left: ["lc", "lr"],
      right: ["rc", "rr"],
    };

    if (!typeMap.hasOwnProperty(buttonEvent.button)) {
      throw new Error("Unexpected button");
    }

    const eventId = typeMap[buttonEvent.button][buttonEvent.isDown ? 0 : 1];
    const elapsedTime = buttonEvent.time.toFixed(3);

    //Deliberately not clamped so off-board presses/releases aren't mistaken for edge tile clicks (they are cell 0)
    const col = this.toCellCoordinate(Math.floor(buttonEvent.xRaw), boardWidth);
    const row = this.toCellCoordinate(
      Math.floor(buttonEvent.yRaw),
      boardHeight
    );
    const coordX = Math.floor(buttonEvent.xRaw * RAWVF_SQUARE_SIZE);
    const coordY = Math.floor(buttonEvent.yRaw * RAWVF_SQUARE_SIZE);

    return `${elapsedTime} ${eventId} ${col} ${row} (${coordX} ${coordY})\n`;
  }

  static getMouseMoveEventLine(move, boardWidth, boardHeight) {
    if (move.type !== "mouse_move") {
      //currently only handle move events and ignore events such as mouse_leave or mouse_enter
      return "";
    }

    const elapsedTime = move.time.toFixed(3);

    const col = Utils.clamp(Math.floor(move.xRaw), 0, boardWidth - 1) + 1;
    const row = Utils.clamp(Math.floor(move.yRaw), 0, boardHeight - 1) + 1;

    const coordX = Utils.clamp(
      Math.floor(move.xRaw * RAWVF_SQUARE_SIZE),
      0,
      boardWidth * RAWVF_SQUARE_SIZE - 1
    );
    const coordY = Utils.clamp(
      Math.floor(move.yRaw * RAWVF_SQUARE_SIZE),
      0,
      boardHeight * RAWVF_SQUARE_SIZE - 1
    );

    const event = `${elapsedTime} mv ${col} ${row} (${coordX} ${coordY})\n`;

    return event;
  }

  static createFileName(boardStats) {
    const boardWidth = boardStats.mines.length;
    const boardHeight = boardStats.mines[0].length;

    const boardMines = boardStats.mines.flat().filter((val) => val).length;

    const variantHyphenated = boardStats.attributes.variant.replaceAll(
      " ",
      "-"
    );

    const endTime = `${boardStats.endTime.toFixed(3)}s`;

    const exportTimestamp = this.getExportTimestamp();

    let fileName = `${boardWidth}x${boardHeight}_${boardMines}-${variantHyphenated}-${endTime}-${exportTimestamp}.rawvf`;

    return fileName;
  }

  static getExportTimestamp() {
    let now = new Date();

    //Get current time. Then convert to desired format, hacky way is with ISOString
    //e.g. 2011-10-05T14:48:00.000Z -> 20111005_144800
    return now
      .toISOString()
      .replace("T", "_")
      .replace(/\.\d{3}Z/, "")
      .replaceAll(":", "")
      .replaceAll("-", "");
  }

  // ########## Practice variant ##########
  //A whole practice set is one RawVF game: one Description/Board/Events section, with time 0 at the
  //first round's reveal. Between rounds the board is reset using a board change block (spec 4.5).
  //Rounds start partly revealed, so full board events are included (BoardEvents: On).

  static createPracticeRawVfText(rounds) {
    const first = rounds[0];
    const last = rounds.at(-1);
    const mineCount = first.mines.flat().filter((s) => s).length;
    const roundsWon = rounds.filter((r) => r.outcome === "won").length;
    const totalTime = last.revealOffset + last.endTime;

    //The game result comes from the last round. Mid-set results are in RoundsWon and the board events.
    let text = "Description:\n";
    text += "RawVF_Version: Rev7\n";
    text += "Program: LlamaSweeper\n";
    text += `Level: ${this.getLevelFromSize({ mines: first.mines })}\n`;
    text += `Width: ${first.width}\n`;
    text += `Height: ${first.height}\n`;
    text += `Mines: ${mineCount}\n`;
    text += "Marks: Off\n";
    text += `SuperClick: ${first.superClick ? "On" : "Off"}\n`;
    text += `SquareSize: ${RAWVF_SQUARE_SIZE}\n`;
    text += `Time: ${totalTime.toFixed(3)}\n`;
    text += `Status: ${last.outcome === "won" ? "won" : "lost"}\n`;
    text += `Mode: ${first.rawvfMode}\n`;
    text += "BoardEvents: On\n";
    text += `Scenario: ${first.scenarioId}\n`;
    text += `ScenarioVersion: ${first.scenarioVersion}\n`;
    text += `Rounds: ${rounds.length}\n`;
    text += `RoundsWon: ${roundsWon}\n`;
    text += `Seeds: ${rounds.map((r) => r.seed).join(",")}\n`;

    text += this.createBoardBlock(first.mines);
    text += "Events:\n";
    text += this.createPracticeEvents(rounds);

    return text;
  }

  static createBoardBlock(mines) {
    const width = mines.length;
    const height = mines[0].length;
    let text = "Board:\n";
    for (let y = 0; y < height; y++) {
      let row = "";
      for (let x = 0; x < width; x++) {
        row += mines[x][y] ? "*" : "0";
      }
      text += row + "\n";
    }
    return text;
  }

  //Tile states at the end of a round, from its starting state plus the board events the player caused
  static getFinalPracticeStates(round) {
    const states = round.initialTiles.map((column) => [...column]);
    for (const boardEvent of round.boardEvents) {
      states[boardEvent.x][boardEvent.y] = boardEvent.state;
    }
    return states;
  }

  static createPracticeEvents(rounds) {
    //Priority orders items with equal times: mouse input, then board changes, then game events
    const items = [];

    rounds.forEach((round, roundIndex) => {
      const isFirst = roundIndex === 0;
      const isLast = roundIndex === rounds.length - 1;

      //Round times are relative to the round's own reveal, so shift them onto the whole game's clock.
      //Mouse movement recorded while the next round was being set up is already stored with this round.
      const offset = round.revealOffset;
      const shifted = (entry) => ({ ...entry, time: entry.time + offset });

      const useButtonEvents =
        recordButtonEvents.value && round.buttonEvents.length > 0;
      if (useButtonEvents) {
        for (const buttonEvent of round.buttonEvents) {
          const event = shifted(buttonEvent);
          items.push({
            time: event.time,
            priority: 0,
            text: this.getButtonEventLine(event, round.width, round.height),
          });
        }
      } else {
        for (const click of round.clicks) {
          const event = shifted(click);
          items.push({
            time: event.time,
            priority: 0,
            text: this.getMouseClickEventLine(
              event,
              round.width,
              round.height,
              round.superClick
            ),
          });
        }
      }

      for (const move of round.moves) {
        const event = shifted(move);
        const line = this.getMouseMoveEventLine(
          event,
          round.width,
          round.height
        );
        if (line !== "") {
          items.push({ time: event.time, priority: 0, text: line });
        }
      }

      if (!isFirst) {
        //The previous round's board is cleared, then the new mines are announced
        const previousStates = this.getFinalPracticeStates(
          rounds[roundIndex - 1]
        );
        const closeLines = [];
        for (let x = 0; x < round.width; x++) {
          for (let y = 0; y < round.height; y++) {
            if (previousStates[x][y] !== CONSTANTS.UNREVEALED) {
              closeLines.push(this.getBoardEventLine("closed", x, y));
            }
          }
        }
        items.push({
          time: round.boardHiddenOffset,
          priority: 1,
          boardLines: closeLines,
        });
        items.push({
          time: round.generatedOffset,
          priority: 2,
          boardChange: this.createBoardBlock(round.mines) + "Events:\n",
        });
      }

      //The first round's starting state appears just before the timer starts (RawVF note 5 uses -0.001 for this).
      //Later rounds reveal while the game is already running.
      const initialLines = [];
      for (let x = 0; x < round.width; x++) {
        for (let y = 0; y < round.height; y++) {
          const eventId = this.getBoardEventId(round.initialTiles[x][y]);
          if (eventId && round.initialTiles[x][y] !== CONSTANTS.UNREVEALED) {
            initialLines.push(this.getBoardEventLine(eventId, x, y));
          }
        }
      }
      items.push({
        time: isFirst ? -0.001 : offset,
        priority: 3,
        boardLines: initialLines,
      });

      if (isFirst) {
        items.push({ time: 0, priority: 4, text: "0.000 start\n" });
      }

      for (const boardEvent of round.boardEvents) {
        //A mine hit only ends the game on the last round, otherwise the set carries on
        const eventId = this.getBoardEventId(boardEvent.state, isLast);
        if (eventId) {
          items.push({
            time: boardEvent.time + offset,
            priority: 3,
            boardLines: [
              this.getBoardEventLine(eventId, boardEvent.x, boardEvent.y),
            ],
          });
        }
      }

      if (isLast) {
        const endTime = offset + round.endTime;
        items.push({
          time: endTime,
          priority: 5,
          text: `${this.formatTime(endTime)} ${
            round.outcome === "won" ? "won" : "lost"
          }\n`,
        });
      }
    });

    items.sort((a, b) => a.time - b.time || a.priority - b.priority);

    let events = "";
    let lastTimeText = null;
    for (const item of items) {
      if (item.boardChange) {
        events += item.boardChange;
        lastTimeText = null; //Events resume after a board change, so the next board event needs its time restated
      } else if (item.boardLines) {
        if (item.boardLines.length === 0) {
          continue;
        }
        //Board events take the time of the preceding line, so add a time marker if that differs
        const timeText = this.formatTime(item.time);
        if (timeText !== lastTimeText) {
          events += `${timeText}\n`;
          lastTimeText = timeText;
        }
        events += item.boardLines.join("");
      } else {
        events += item.text;
        lastTimeText = this.formatTime(item.time);
      }
    }

    return events;
  }

  //Board arrays here are 0-based, but RawVF cell coordinates are 1-based
  static getBoardEventLine(eventId, tileX, tileY) {
    return `${eventId} ${tileX + 1} ${tileY + 1}\n`;
  }

  static getBoardEventId(state, blastEndsGame = true) {
    if (typeof state === "number") {
      return `number${state}`;
    }
    switch (state) {
      case CONSTANTS.UNREVEALED:
        return "closed";
      case CONSTANTS.FLAG:
        return "flag";
      case CONSTANTS.MINERED:
        return blastEndsGame ? "blast" : "local_blast";
      default:
        return null;
    }
  }

  static formatTime(time) {
    const text = time.toFixed(3);
    return text === "-0.000" ? "0.000" : text;
  }

  static createPracticeFileName(rounds) {
    const first = rounds[0];
    return `${first.width}x${first.height}-practice-${first.scenarioId}-${
      rounds.length
    }r-${this.getExportTimestamp()}.rawvf`;
  }

  static downloadPracticeRawVf(rounds) {
    exportFile(
      this.createPracticeFileName(rounds),
      this.createPracticeRawVfText(rounds)
    );
  }

  static sendPracticeToStrangeDust(rounds) {
    this.sendRawVfTextToStrangeDust(
      this.createPracticeRawVfText(rounds),
      this.createPracticeFileName(rounds)
    );
  }
}

export default RawVF;
