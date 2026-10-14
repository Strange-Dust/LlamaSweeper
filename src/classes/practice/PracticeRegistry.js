/*
  Central lookup for everything a practice scenario can be built from.

  Scenario definitions are plain (serialisable) data that refer to the other
  building blocks by id, e.g. `generator: { type: "single-target" }`.
  This keeps built-in scenarios and future user-made scenarios the same shape.

  Building block contracts:
    generator(ctx) -> { mines, initialTiles, targets, meta }
      ctx = { width, height, params, rng }
    completionRule({ board, round, params }) -> "won" | "lost" | null
    metric = { id, label, unit, better: "lower" | "higher", compute(record, params) -> number | null }
*/

const registries = {
  scenario: new Map(),
  generator: new Map(),
  completion: new Map(),
  metric: new Map(),
};

function register(kind, id, value) {
  if (typeof id !== "string" || id === "") {
    throw new Error(`Practice ${kind} must have a non-empty string id`);
  }
  if (registries[kind].has(id)) {
    throw new Error(`Practice ${kind} "${id}" is already registered`);
  }
  registries[kind].set(id, value);
}

const PracticeRegistry = {
  registerScenario(definition) {
    register("scenario", definition.id, Object.freeze(definition));
  },
  registerGenerator(id, generatorFn) {
    register("generator", id, generatorFn);
  },
  registerCompletionRule(id, ruleFn) {
    register("completion", id, ruleFn);
  },
  registerMetric(metric) {
    register("metric", metric.id, Object.freeze(metric));
  },

  getScenario(id) {
    return registries.scenario.get(id) ?? null;
  },
  listScenarios() {
    return [...registries.scenario.values()];
  },
  getGenerator(id) {
    return registries.generator.get(id) ?? null;
  },
  getCompletionRule(id) {
    return registries.completion.get(id) ?? null;
  },
  getMetric(id) {
    return registries.metric.get(id) ?? null;
  },
};

export default PracticeRegistry;
