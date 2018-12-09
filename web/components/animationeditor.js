import { Rules } from '../model/ca.js';
import { Animation, AnimationStep } from '../model/animation.js';

export const AnimationEditor = Vue.extend({
    template: `
        <div>
            <table>
                <tr>
                    <th>&nbsp;</th>
                    <th>Rule</th>
                    <th># of ticks</th>
                    <th>Duration (ms)</th>
                    <td>&nbsp;</th>
                </tr>
                <tr v-for="(step, stepIndex) in animation.steps">
                    <td>
                        <button @click="addStep(stepIndex)">+</button>
                    </td>
                    <td>
                        <select v-model="step.transitionRule">
                            <option v-for="rule in rules" :value="rule">
                                {{rule.name}}
                            </option>
                        </select>
                    </td>
                    <td>
                        <input type="number" v-model.number="step.numTicks" />
                    </td>
                    <td>
                        <input type="number" v-model.number="step.durationMillis" />
                    </td>
                    <td>
                        <button @click="removeStep(stepIndex)">X</button>
                    </td>
                </tr>
                <tr>
                    <td>
                        <button @click="addStep(animation.steps.length)">+</button>
                    </td>
                </tr>
            </table>
        </div>
    `,

    props: ['animation', 'rules'],

    methods: {
        addStep(index) {
            const rule = (index < this.animation.steps.length) ?
                this.animation.steps[index].transitionRule : this.rules[0];
            const newStep = new AnimationStep(rule, 0, 0, null);
            this.animation.addStepAtIndex(newStep, index);
        },

        removeStep(index) {
            this.animation.removeStepAtIndex(index);
        },
    },
});
