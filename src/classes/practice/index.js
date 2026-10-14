/*
  Entry point for the practice framework. Import from "src/classes/practice".

  To add a scenario: create a definition in ./scenarios and register it below.
  New generators, completion rules and metrics are registered here the same way.
*/

import PracticeRegistry from "./PracticeRegistry";

import singleTarget from "./generators/singleTarget";
import { allSafeRevealed, targetsRevealed } from "./completion/rules";
import aimMetrics from "./metrics/aimMetrics";

import flick from "./scenarios/flick";

PracticeRegistry.registerGenerator("single-target", singleTarget);

PracticeRegistry.registerCompletionRule("all-safe-revealed", allSafeRevealed);
PracticeRegistry.registerCompletionRule("targets-revealed", targetsRevealed);

aimMetrics.forEach((metric) => PracticeRegistry.registerMetric(metric));

PracticeRegistry.registerScenario(flick);

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
