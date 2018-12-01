// Optimization for getting the bits of integers between 0 and 15.
const INTEGER_BITS = [
    [0, 0, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 0],
    [0, 0, 1, 1],
    [0, 1, 0, 0],
    [0, 1, 0, 1],
    [0, 1, 1, 0],
    [0, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 0, 0, 1],
    [1, 0, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 0, 0],
    [1, 1, 0, 1],
    [1, 1, 1, 0],
    [1, 1, 1, 1],
];

/**
 * Transition table for a 2x2 block of a cellular automaton using the Margolus neighborhood.
 * On every tick, the grid is divided into 2x2 blocks. On odd ticks, the blocks are shifted
 * one cell vertically and horizontally relative to even ticks. Each block is updated according
 * to a table that maps the four input bits to four output bits. For a reversible cellular
 * automaton, this mapping must be one-to-one, so that every possible output is produced by
 * exactly one input. There can be separate mappings for even and odd ticks.
 */
class TransitionTable {
    constructor(evenForward, opt_oddForward) {
        this.evenForward = evenForward.slice();
        this.evenBackward = verifyAndInvertStates(this.evenForward);
        this.oddForward = (opt_oddForward || evenForward).slice();
        this.oddBackward = verifyAndInvertStates(this.oddForward);
    }

    /**
     * Returns the next state of a 2x2 block. The returned value is a four bit integer
     * (i.e. between 0 and 15), where the binary digits define the active cells of the next state.
     * The order from most significant to least significant bits is top left, top right,
     * bottom left, and bottom right. For example, a return value of 5 (0b0101) means that the
     * next state should have the top right and bottom right cells enabled.
     */
    nextBlockState(useEvenGrid, isForward, topLeft, topRight, bottomLeft, bottomRight) {
        const index = (topLeft ? 8 : 0) + (topRight ? 4 : 0) + (bottomLeft ? 2 : 0) + (bottomRight);
        const table = useEvenGrid ?
            (isForward ? this.evenForward : this.evenBackward) :
            (isForward ? this.oddForward : this.oddBackward);
        return table[index];
    }
}

export class MargolusCA {
    constructor(numRows, numCols) {
        if (numRows % 2 !== 0 || numCols % 2 !== 0) {
            throw Error(`${numRows}x${numCols} cannot divide into 2x2 blocks`);
        }
        this.numRows = numRows;
        this.numCols = numCols;
        this.frameNumber = 0;
        this.currentGrid = new Int8Array(numRows * numCols);
        this.scratchGrid = new Int8Array(numRows * numCols);
        this.isReversed = false;
        this.transitionRule = Rules.CRITTERS;
    }

    copy() {
        const ca = new MargolusCA(this.numRows, this.numCols);
        ca.currentGrid = Int8Array.from(this.currentGrid);
        ca.frameNumber = this.frameNumber;
        ca.isReversed = this.isReversed;
        ca.transitionRule = this.transitionRule;
        return ca;
    }

    copyWithSize(numRows, numCols) {
        const ca = new MargolusCA(numRows, numCols);
        ca.transitionRule = this.transitionRule;
        const rowLimit = Math.min(this.numRows, ca.numRows);
        const colLimit = Math.min(this.numCols, ca.numCols);
        for (let r = 0; r < rowLimit; r++) {
            for (let c = 0; c < colLimit; c++) {
                if (this.at(r, c)) {
                    ca.setCells([[r, c]], true);
                }
            }
        }
        return ca;
    }

    numCells() {
        return this.numRows * this.numCols;
    }

    at(r, c) {
        return this.currentGrid[r * this.numCols + c];
    }

    setCells(cellRCList, enabled) {
        const value = enabled ? 1 : 0;
        for (const rc of cellRCList) {
            const index = rc[0] * this.numCols + rc[1];
            this.currentGrid[index] = value;
        }
    }

    setIndices(indexList, enabled) {
        const value = enabled ? 1 : 0;
        for (const i of indexList) {
            this.currentGrid[i] = value;
        }
    }

    reset() {
        this.currentGrid = new Int8Array(this.numRows * this.numCols);
        this.isReversed = false;
        this.frameNumber = 0;
    }

    _update2x2Block(isEven, topLeft, topRight, bottomLeft, bottomRight) {
        // https://en.wikipedia.org/wiki/Critters_(block_cellular_automaton)
        const cg = this.currentGrid;
        const sg = this.scratchGrid;
        const index = this.transitionRule.table.nextBlockState(
            isEven, !this.isReversed, cg[topLeft], cg[topRight], cg[bottomLeft], cg[bottomRight]);
        const nextCells = INTEGER_BITS[index];
        sg[topLeft] = nextCells[0];
        sg[topRight] = nextCells[1];
        sg[bottomLeft] = nextCells[2];
        sg[bottomRight] = nextCells[3];
    }

    useEvenGrid() {
        return (this.frameNumber % 2 === 0) !== this.isReversed;
    }

    tick() {
        if (this.useEvenGrid()) {
            for (let r = 0; r < this.numRows; r += 2) {
                const rowOffset = r * this.numCols;
                for (let c = 0; c < this.numCols; c += 2) {
                    const offset = rowOffset + c;
                    this._update2x2Block(true,
                        offset, offset + 1,
                        offset + this.numCols, offset + this.numCols + 1);
                }
            }
        }
        else {
            // Interior points.
            for (let r = 1; r < this.numRows - 1; r += 2) {
                const rowOffset = r * this.numCols;
                for (let c = 1; c < this.numCols - 1; c += 2) {
                    const offset = rowOffset + c;
                    this._update2x2Block(false,
                        offset, offset + 1,
                        offset + this.numCols, offset + this.numCols + 1);
                }
            }
            // Along bottom row, wrapping to top.
            const lastRowOffset = this.numCols * (this.numRows - 1);
            for (let c = 1; c < this.numCols - 1; c += 2) {
                this._update2x2Block(false,
                    lastRowOffset + c, lastRowOffset + c + 1,
                    c, c + 1);
            }
            // Along right edge, wrapping to left.
            for (let r = 1; r < this.numRows - 1; r += 2) {
                const rowOffset = r * this.numCols;
                this._update2x2Block(false,
                    rowOffset + this.numCols - 1, rowOffset,
                    rowOffset + 2 * this.numCols - 1, rowOffset + this.numCols);
            }
            // "Top left" at bottom right, wrapping to the other corners.
            this._update2x2Block(false,
                this.numRows * this.numCols - 1, (this.numRows - 1) * this.numCols,
                this.numCols - 1, 0);
        }
        const cg = this.currentGrid;
        this.currentGrid = this.scratchGrid;
        this.scratchGrid = cg;
        this.frameNumber += (this.isReversed) ? -1 : 1;
    }

    reverse() {
        this.isReversed = !this.isReversed;
    }
}

const verifyAndInvertStates = (states) => {
    if (states.length !== 16) {
        throw Error(`States array must have length of 16, got ${states.length}`);
    }
    const inverse = [];
    const sset = new Set();
    for (let i = 0; i < states.length; i++) {
        const s = states[i];
        if (!Number.isInteger(s)) {
            throw Error(`States array has non-integer at index ${i}: ${s}`);
        }
        if (s < 0 || s >= 16) {
            throw Error(`States array has value out of range at index ${i}: ${s}`);
        }
        if (sset.has(s)) {
            throw Error(`States array has duplicate value: ${s}`);
        }
        sset.add(s);
        inverse[s] = i;
    }
    return inverse;
}

export const Rules = {
    // https://en.wikipedia.org/wiki/Critters_(block_cellular_automaton)
    // We use the variation that has different transitions for even and odd frames.
    // This preserves the number of active cells.
    CRITTERS: {
        name: 'Critters',
        // If two cells are active, invert the block. Rotate a half turn if three cells are active
        // on an even frame, or if one cell is active on an odd frame.
        table: new TransitionTable(
            [
                0b0000, 0b0001, 0b0010, 0b1100, 0b0100, 0b1010, 0b1001, 0b1110,
                0b1000, 0b0110, 0b0101, 0b1101, 0b0011, 0b1011, 0b0111, 0b1111,
            ],
            [
                0b0000, 0b1000, 0b0100, 0b1100, 0b0010, 0b1010, 0b1001, 0b0111,
                0b0001, 0b0110, 0b0101, 0b1011, 0b0011, 0b1101, 0b1110, 0b1111,
            ]),
    },

    // https://en.wikipedia.org/wiki/Reversible_cellular_automaton#Synchronization
    // The "official" Tron rule inverts a block if none or all of the cells are active.
    // That causes lots of flashing, so we do the opposite and invert if between 1 and 3
    // are active. This is equivalent to applying the none/all rule and then inverting the
    // entire grid, so the overall behavior is the same.
    TRON: {
        name: 'Tron',
        // 0000 and 1111 are unchanged, everything else inverts (i => 15-i).
        table: new TransitionTable([0, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 15]),
    },

    // https://www.mitpressjournals.org/doi/pdf/10.1162/978-0-262-32621-6-ch084
    HIGHLANDER: {
        name: 'Highlander',
        // Invert if two cells are active, rotate a quarter turn counterclockwise if one cell is
        // active, rotate a quarter turn clockwise if three cells are active.
        table: new TransitionTable([
            0b0000, 0b0100, 0b0001, 0b1100, 0b1000, 0b1010, 0b1001, 0b1011,
            0b0010, 0b0110, 0b0101, 0b1110, 0b0011, 0b0111, 0b1101, 0b1111,
        ]),
    },

    // https://en.wikipedia.org/wiki/Reversible_cellular_automaton#Billiard_ball_computation_and_low-power_computing
    // http://fab.cba.mit.edu/classes/862.16/notes/computation/Margolus-1984.pdf
    BILLIARD_BALL: {
        name: 'Billiard ball',
        // Rotate a half turn if one cell is active. Invert if two cells are active and
        // diagonally opposite.
        table: new TransitionTable([
            0b0000, 0b1000, 0b0100, 0b0011, 0b0010, 0b0101, 0b1001, 0b0111,
            0b0001, 0b0110, 0b1010, 0b1011, 0b1100, 0b1101, 0b1110, 0b1111,
        ]),
    },

    // https://web.mit.edu/lrs/www/physCA/
    SCHAEFFER: {
        name: 'Schaeffer',
        // Rotate a half turn if one or two cells are active. (This is a no-op if two active cells
        // are diagonally opposite).
        table: new TransitionTable([
            0b0000, 0b1000, 0b0100, 0b1100, 0b0010, 0b1010, 0b0110, 0b0111,
            0b0001, 0b1001, 0b0101, 0b1011, 0b0011, 0b1101, 0b1110, 0b1111,
        ]),
    },
};
