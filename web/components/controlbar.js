import { Animation, AnimationStep } from '../model/animation.js';
import { TransitionTable, Rules } from '../model/ca.js';
import { AnimationEditor } from './animationeditor.js';
import { TransitionTableEditor } from './ruleeditor.js';

export const ControlBarComponent = Vue.extend({
    template: `
        <div class="controls">
            <div>
                Rule:
                <select v-model="selectedRule" @change="updateTransitionRule()">
                    <option v-for="rule in state.availableRules" :value="rule">
                        {{rule.name}}
                    </option>
                </select>
                <button @click="stepForward()">Step forward</button>
                <button @click="stepBackward()">Step backward</button>
            </div>
            <div>
                <button :disabled="ruleDialogVisible" @click="ruleDialogVisible = true">
                    New rule...
                </button>
                <button
                    :disabled="!isValidRuleHex(newRuleHex)"
                    @click="addRuleFromHex(newRuleHex)">Add rule from hex</button>
                <input type="text" size="36" v-model="newRuleHex" />
            </div>
            <div>
                <button @click="runForward()">Run forward</button>
                <button @click="runBackward()">Run backward</button>
                <button @click="stop()">Stop</button>
                Update display:
                <select v-model="selectedBatchFrameCount" @change="updateBatchFrameCount()">
                    <option :value="1">Every tick</option>
                    <option :value="10">Every 10 ticks</option>
                    <option :value="100">Every 100 ticks</option>
                    <option :value="Infinity">As fast as possible</option>
                </select>
            </div>
            <div>
                Run for ticks: <input type="number" v-model.number="targetTickCount" />
                <button @click="runForTicks(targetTickCount)">Go</button>
            </div>
            <div>
                Resize to rows: <input type="number" v-model.number="newGridRows">
                columns: <input type="number" v-model.number="newGridCols">
                <button @click="resizeGrid()">Resize</button>
            </div>
            <div>
                <button @click="reset()">Reset</button>
                <button @click="fillRandom()">Random</button>
            </div>
            <div>
                <textarea v-model="activeCellsJson"></textarea>
                <button @click="retrieveActiveCells()">Retrieve cells</button>
                <button @click="updateActiveCells()">Update cells</button>
            </div>
            <div>
                <AnimationEditor :animation="animation" :rules="state.availableRules" />
                <button @click="state.runAnimation(animation)">Run animation</button>
                <button @click="state.runAnimation(animation.reversed())">Run reversed</button>
            </div>
            <div class="rule-dialog-overlay" v-if="ruleDialogVisible">
                <div class="rule-dialog">
                    <TransitionTableEditor
                        v-if="ruleDialogVisible"
                        :initial-table="this.selectedRule.table"
                        @save="saveRuleFromEditor($event)"
                        @cancel="cancelRuleEdit()" />
                </div>
            </div>
        </div>
    `,

    props: ['state'],

    components: {
        AnimationEditor: AnimationEditor,
        TransitionTableEditor : TransitionTableEditor,
    },

    data: () => ({
        activeCellsJson: '',
        targetTickCount: 0,
        selectedRule: null,
        selectedBatchFrameCount: 1,
        newGridRows: 0,
        newGridCols: 0,
        newRuleHex: '',
        ruleDialogVisible: false,
        animation: new Animation([new AnimationStep(Rules.CRITTERS, 1000, 2000, null)]),
    }),

    mounted() {
        this.selectedRule = this.state.ca.transitionRule;
        this.selectedBatchFrameCount = this.state.batchFrameCount;
        this.newGridRows = this.state.ca.numRows;
        this.newGridCols = this.state.ca.numCols;
    },

    methods: {
        stepForward() {
            this.state.stepForward();
        },

        stepBackward() {
            this.state.stepBackward();
        },

        runForward() {
            this.state.runForward();
        },

        runBackward() {
            this.state.runBackward();
        },

        runForTicks(tickCount) {
            this.state.runForTicks(tickCount);
        },

        stop() {
            this.state.stopRunning();
        },

        reset() {
            this.state.reset();
        },

        fillRandom() {
            this.state.fillRandom(0.05);
        },

        retrieveActiveCells() {
            this.activeCellsJson = JSON.stringify(this.state.getActiveCells());
        },

        updateActiveCells() {
            const activeCells = JSON.parse(this.activeCellsJson);
            this.state.reset();
            this.state.setCells(activeCells, true);
        },

        updateTransitionRule() {
            this.state.setTransitionRule(this.selectedRule);
        },

        updateBatchFrameCount() {
            this.state.setBatchFrameCount(this.selectedBatchFrameCount);
        },

        resizeGrid() {
            if (Number.isFinite(this.newGridRows) && Number.isFinite(this.newGridCols)) {
                this.state.resizeGrid(this.newGridRows, this.newGridCols);
            }
        },

        isValidRuleHex(hex) {
            return TransitionTable.isValidHex(hex);
        },

        addRuleFromHex(hex) {
            const newRule = this.state.addRuleFromHex(hex);
            this.selectedRule = newRule;
            this.updateTransitionRule();
        },

        saveRuleFromEditor(table) {
            const newRule = this.state.addRuleFromHex(table.toHex());
            this.selectedRule = newRule;
            this.updateTransitionRule();
            this.ruleDialogVisible = false;
        },

        cancelRuleEdit() {
            this.ruleDialogVisible = false;
        },
    },
});
