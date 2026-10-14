import { PracticeRegistry } from "./index";
import { getOptionValues, getOptionStorageKey } from "./resolveScenario";

import {
  boardWidth,
  boardHeight,
  practiceScenarioId,
  practiceScenarioOptions,
} from "src/composables/useSettings";

//Helpers shared by the PracticeMode controller and the practice UI components.

export function getSelectedScenarioDefinition() {
  return (
    PracticeRegistry.getScenario(practiceScenarioId.value) ??
    PracticeRegistry.listScenarios()[0]
  );
}

export function getSelectedOptionValues(definition) {
  const stored =
    practiceScenarioOptions.value?.[getOptionStorageKey(definition)] ?? {};
  return getOptionValues(definition, stored);
}

export function setSelectedOptionValue(definition, key, value) {
  const storageKey = getOptionStorageKey(definition);
  const all = practiceScenarioOptions.value ?? {};
  practiceScenarioOptions.value = {
    ...all,
    [storageKey]: { ...(all[storageKey] ?? {}), [key]: value },
  };
}

export function getPracticeBoardSize(boardSpec) {
  if (boardSpec.allowUserSize) {
    const width = Math.max(boardWidth.value, boardSpec.minWidth ?? 1);
    const height = Math.max(boardHeight.value, boardSpec.minHeight ?? 1);
    return {
      width,
      height,
      isEnlarged: width !== boardWidth.value || height !== boardHeight.value,
    };
  }
  return {
    width: boardSpec.width,
    height: boardSpec.height,
    isEnlarged: false,
  };
}
