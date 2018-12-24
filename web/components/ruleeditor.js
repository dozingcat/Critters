import { TransitionTable } from '../model/ca.js';
import { arraysEqual, intArrayToHex, swapArrayElements } from '../util/arrays.js';

const TransitionGridIcon = Vue.extend({
    template: `
        <div class="transition-grid-icon">
            <div :class="cssClassForBit(8)"></div>
            <div :class="cssClassForBit(4)"></div>
            <div :class="cssClassForBit(2)"></div>
            <div :class="cssClassForBit(1)"></div>
        </div>
    `,

    props: ['value'],

    methods: {
        cssClassForBit(bit) {
            return ((this.value & bit) !== 0) ? 'on' : 'off';
        },
    }
});

const IDENITTY_LIST = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const TransitionListGrid = Vue.extend({
    template: `
        <div class="transition-grid">
            <div class="transition-grid-entry" v-for="(output, index) in value">
                <TransitionGridIcon :value="index" />
                <span class="arrow">➡</span>
                <TransitionGridIcon
                    :value="output"
                    draggable
                    @dragstart.native="startDrag($event, index)"
                    @dragover.native.prevent="dragOver($event, index)"
                    @drop.native.prevent="drop($event, index)"
                    />
                <span class="spacer"></span>
            </div>
        </div>
    `,

    components: {
        TransitionGridIcon: TransitionGridIcon,
    },

    // 'value' prop and 'input' event allows this component to work with v-model.
    props: ['value'],

    methods: {
        startDrag(event, srcIndex) {
            event.dataTransfer.setData('text/plain', String(srcIndex));
            event.dataTransfer.allowedEffect = 'move';
        },

        dragOver(event, dstIndex) {
            event.dataTransfer.dropEffect = 'move';
        },

        drop(event, dstIndex) {
            const srcIndex = parseInt(event.dataTransfer.getData('text/plain'), 10);
            const newList = this.value.slice();
            swapArrayElements(newList, srcIndex, dstIndex);
            this.$emit('input', newList);
        },
    },
});

export const TransitionTableEditor = Vue.extend({
    template: `
        <div class="transition-table-editor">
            <div>
                <label>
                    <input type="checkbox"
                        v-model="showSeparateLists" @change="toggleSeparateLists()" />
                    Separate transitions for even and odd ticks
                </label>
            </div>
            <div>
                <h3 v-if="showSeparateLists">Even tick transitions</h3>
                <TransitionListGrid v-model="evenTransitionList" />
            </div>
            <div v-if="showSeparateLists">
                <h3>Odd tick transitions</h3>
                <TransitionListGrid v-model="oddTransitionList" />
            </div>
            <div>
                Rule hex code: {{ruleHexCode}}
            </div>
            <div>
                <button @click="doSave()">Save</button>
                <button @click="doCancel()">Cancel</button>
            </div>
        </div>
    `,

    components: {
        TransitionListGrid: TransitionListGrid,
    },

    props: ['initialTable'],

    data: () => ({
        evenTransitionList: IDENITTY_LIST,
        oddTransitionList: IDENITTY_LIST,
        showSeparateLists: false,
    }),

    computed: {
        hasSeparateLists() {
            return this.showSeparateLists &&
                !arraysEqual(this.evenTransitionList, this.oddTransitionList);
        },

        ruleHexCode() {
            const evenHex = intArrayToHex(this.evenTransitionList);
            return this.hasSeparateLists ?
                evenHex + intArrayToHex(this.oddTransitionList) :
                evenHex;
        },
    },

    mounted() {
        this.evenTransitionList = this.initialTable ? this.initialTable.evenForward : IDENITTY_LIST;
        this.oddTransitionList = this.initialTable ? this.initialTable.oddForward : IDENITTY_LIST;
        this.showSeparateLists = !arraysEqual(this.evenTransitionList, this.oddTransitionList);
    },

    methods: {
        toggleSeparateLists() {
            if (this.showSeparateLists) {
                this.oddTransitionList = this.evenTransitionList.slice();
            }
        },

        doSave() {
            const newTable = new TransitionTable(
                this.evenTransitionList,
                this.hasSeparateLists ? this.oddTransitionList : undefined);
            this.$emit('save', newTable);
        },

        doCancel() {
            this.$emit('cancel');
        },
    },
});
