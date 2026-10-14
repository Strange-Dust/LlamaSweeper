<template>
  <q-dialog v-model="practicePickerModal">
    <q-card style="width: 500px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">Choose a practice scenario</div>
      </q-card-section>

      <q-list class="q-pb-md">
        <template v-for="group in groups" :key="group.category">
          <q-item-label header>{{ group.category }}</q-item-label>
          <q-item
            v-for="scenario in group.scenarios"
            :key="scenario.id"
            clickable
            v-close-popup
            :active="scenario.id === selectedId"
            active-class="text-primary"
            @click="select(scenario.id)"
          >
            <q-item-section>
              <q-item-label>{{ scenario.name }}</q-item-label>
              <q-item-label caption>{{ scenario.description }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="scenario.id === selectedId" side>
              <q-icon name="check" color="primary" />
            </q-item-section>
          </q-item>
        </template>
      </q-list>

      <q-card-actions align="right" class="text-primary">
        <q-btn flat label="Close" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, inject } from "vue";
import { PracticeRegistry } from "src/classes/practice";
import { getSelectedScenarioDefinition } from "src/classes/practice/practiceSelection";
import {
  practicePickerModal,
  practiceScenarioId,
} from "src/composables/useSettings";

defineOptions({
  name: "PracticeScenarioPickerModal",
});

const game = inject("game");

const selectedId = computed(() => getSelectedScenarioDefinition()?.id);

const groups = computed(() => {
  const byCategory = new Map();
  for (const scenario of PracticeRegistry.listScenarios()) {
    const category = scenario.category ?? "Other";
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category).push(scenario);
  }
  return [...byCategory].map(([category, scenarios]) => ({
    category,
    scenarios,
  }));
});

function select(id) {
  if (id === selectedId.value) {
    return;
  }
  practiceScenarioId.value = id;
  game.reset();
}
</script>
