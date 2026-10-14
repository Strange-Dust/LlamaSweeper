<template>
  <div class="q-mt-sm">
    <div
      class="flex flex-centreable items-center q-px-md q-mx-md q-mb-md"
      style="gap: 12px"
    >
      <q-btn
        color="secondary"
        icon="fitness_center"
        label="Choose scenario"
        @click="practicePickerModal = true"
      />
      <div style="flex: 0 1 480px; min-width: 200px">
        <div class="text-subtitle1">
          {{ definition.name }}
          <q-badge outline color="info" :label="definition.category" />
        </div>
        <div class="text-caption">{{ definition.description }}</div>
      </div>
    </div>

    <PracticeScenarioOptions class="flex-centreable" :definition="definition" />

    <p v-if="boardSize.isEnlarged" class="text-caption text-centreable q-px-md">
      This scenario needs at least a
      {{ definition.board.minWidth ?? 1 }}x{{
        definition.board.minHeight ?? 1
      }}
      board, so it is using {{ boardSize.width }}x{{ boardSize.height }}.
    </p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import PracticeScenarioOptions from "src/components/practice/PracticeScenarioOptions.vue";
import {
  getSelectedScenarioDefinition,
  getPracticeBoardSize,
} from "src/classes/practice/practiceSelection";
import { practicePickerModal } from "src/composables/useSettings";

defineOptions({
  name: "PracticeConfigBar",
});

const definition = computed(() => getSelectedScenarioDefinition());

const boardSize = computed(() => getPracticeBoardSize(definition.value.board));
</script>
