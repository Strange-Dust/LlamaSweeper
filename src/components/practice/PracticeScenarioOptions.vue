<template>
  <div class="flex q-mx-md">
    <template v-for="option in definition.options ?? []" :key="option.key">
      <q-select
        v-if="option.type === 'select'"
        class="q-mx-md q-mb-md"
        outlined
        options-dense
        dense
        transition-duration="100"
        input-debounce="0"
        :model-value="values[option.key]"
        :options="getOptionChoices(option)"
        emit-value
        map-options
        stack-label
        :label="option.label"
        :hint="option.hint"
        style="width: 200px; flex-shrink: 0"
        @update:model-value="(value) => update(option.key, value)"
      />
      <q-input
        v-else-if="option.type === 'number'"
        class="q-mx-md q-mb-md"
        outlined
        dense
        stack-label
        type="number"
        debounce="300"
        :model-value="values[option.key]"
        :label="option.label"
        :hint="option.hint"
        :min="option.min"
        :max="option.max"
        :step="option.step"
        style="width: 150px; flex-shrink: 0"
        @update:model-value="(value) => update(option.key, Number(value))"
      />
      <q-toggle
        v-else-if="option.type === 'toggle'"
        class="q-mx-md q-mb-md"
        :model-value="values[option.key]"
        :label="option.label"
        @update:model-value="(value) => update(option.key, value)"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from "vue";
import { getOptionChoices } from "src/classes/practice";
import {
  getSelectedOptionValues,
  setSelectedOptionValue,
} from "src/classes/practice/practiceSelection";

defineOptions({
  name: "PracticeScenarioOptions",
});

//Renders a scenario's option schema, so new scenarios get their controls for free
const props = defineProps({
  definition: { type: Object, required: true },
});

const game = inject("game");

const values = computed(() => getSelectedOptionValues(props.definition));

function update(key, value) {
  setSelectedOptionValue(props.definition, key, value);
  game.reset();
}
</script>
