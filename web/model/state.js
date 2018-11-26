import {MargolusCA, Rules} from './ca.js';

export class AppState {
    constructor(args) {
        args = args || {};
        this.timestampFn = args.timestampFn || Date.now;
        this.timeoutFn = args.timeoutFn || window.setTimeout.bind(window);
        this.randomFn = args.randomFn || Math.random;

        this.ca = new MargolusCA(100, 100);
        this.ca.transitionRule = Rules.CRITTERS;
        this.gridCallbacks = new Set();
        this.runStatus = RunStatus.STOPPED;
        this.editMode = EditMode.NONE;
        this.targetMillisPerFrame = 16;
        this.maxMillisPerUpdate = 30;
        this.targetFrameOffset = 0;
        this.batchFrameCount = 1;
    }

    tick() {
        this.ca.tick();
        this.notifyGridChanged();
    }

    stepForward() {
        this.ca.isReversed = false;
        this.tick();
    }

    stepBackward() {
        this.ca.isReversed = true;
        this.tick();
    }

    runForward() {
        this.runForTicks(Infinity);
    }

    runBackward() {
        this.runForTicks(-Infinity);
    }

    runForTicks(tickCount) {
        if (this.runStatus !== RunStatus.STOPPED) {
            return;
        }
        this.runStatus = RunStatus.RUNNING_TO_TARGET;
        this.ca.isReversed = (tickCount < 0);
        const absOffset = Math.abs(tickCount);
        let totalSteps = 0;
        const tickFn = () => {
            if (this.runStatus !== RunStatus.RUNNING_TO_TARGET) {
                return;
            }
            const maxFrames = Math.max(1, this.batchFrameCount);
            const startTime = this.timestampFn();
            let elapsedMillis = 0;
            for (let i = 0; i < maxFrames && totalSteps < absOffset; i++) {
                this.ca.tick();
                totalSteps += 1;
                elapsedMillis = this.timestampFn() - startTime;
                if (elapsedMillis >= this.maxMillisPerUpdate || totalSteps === absOffset) {
                    break;
                }
            }
            if (totalSteps < absOffset) {
                const sleepMillis = Math.max(1, this.targetMillisPerFrame - elapsedMillis);
                this.timeoutFn(tickFn, sleepMillis);
            }
            else {
                this.runStatus = RunStatus.STOPPED;
            }
            this.notifyGridChanged();
        };
        tickFn();
    }

    stopRunning() {
        this.runStatus = RunStatus.STOPPED;
    }

    resizeGrid(numRows, numCols) {
        this.ca = this.ca.copyWithSize(numRows, numCols);
        this.notifyGridChanged();
    }

    setCell(row, col, value) {
        this.ca.setCells([[row, col]], value);
        this.notifyGridChanged();
    }

    toggleCell(row, col) {
        this.setCell(row, col, 1 - this.ca.at(row, col));
    }

    setCells(cellRCList, value) {
        this.ca.setCells(cellRCList, value);
        this.notifyGridChanged();
    }

    setTransitionRule(rule) {
        this.ca.transitionRule = rule;
    }

    setBatchFrameCount(count) {
        this.batchFrameCount = count;
    }

    reset() {
        this.ca.reset();
        this.notifyGridChanged();
    }

    fillRandom(p) {
        this.runState = RunStatus.STOPPED;
        this.ca.reset();
        const indices = [];
        const numCells = this.ca.numCells();
        for (let i = 0; i < numCells; i++) {
            if (this.randomFn() < p) {
                indices.push(i);
            }
        }
        this.ca.setIndices(indices, true);
        this.notifyGridChanged();
    }

    notifyGridChanged() {
        for (const cb of this.gridCallbacks) {
            cb(this.ca);
        }
    }

    addGridCallback(cb) {
        this.gridCallbacks.add(cb);
    }

    getActiveCells() {
        const ca = this.ca;
        const cells = [];
        for (let r = 0; r < ca.numRows; r++) {
            for (let c = 0; c < ca.numCols; c++) {
                if (ca.at(r, c)) {
                    cells.push([r, c]);
                }
            }
        }
        return cells;
    }
}

export const RunStatus = {
    STOPPED: 0,
    RUNNING_TO_TARGET: 1,
    RUNNING_ANIMATION: 2,
};

export const EditMode = {
    NONE: 0,
    DRAW: 1,
    SELECT: 2,
};