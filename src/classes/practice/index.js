/*
  Entry point for the practice framework. Import from "src/classes/practice".

  To add a scenario: create a definition in ./scenarios and register it below.
  New generators, completion rules and metrics are registered here the same way.
*/

import PracticeRegistry from "./PracticeRegistry";

import singleTarget from "./generators/singleTarget";
import line from "./generators/line";
import { allSafeRevealed, targetsRevealed } from "./completion/rules";
import aimMetrics from "./metrics/aimMetrics";

import flick from "./scenarios/flick";
import lineScenario from "./scenarios/line";

PracticeRegistry.registerGenerator("single-target", singleTarget);
PracticeRegistry.registerGenerator("line", line);

PracticeRegistry.registerCompletionRule("all-safe-revealed", allSafeRevealed);
PracticeRegistry.registerCompletionRule("targets-revealed", targetsRevealed);

aimMetrics.forEach((metric) => PracticeRegistry.registerMetric(metric));

PracticeRegistry.registerScenario(flick);
PracticeRegistry.registerScenario(lineScenario);

export { PracticeRegistry };
export {
  resolveScenario,
  getOptionValues,
  getOptionChoices,
  getOptionStorageKey,
} from "./resolveScenario";
export {
  computeMetrics,
  summariseRounds,
  formatMetricValue,
  formatMetricNumber,
  getMetricUnitLabel,
} from "./metrics/metricResults";
