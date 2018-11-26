const BlockAction = {
    NOOP: 0,
    INVERT: 1,
    ROTATE_90: 2,
    ROTATE_180: 3,
    ROTATE_270: 4,
};

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

    _update2x2Block(topLeft, topRight, bottomLeft, bottomRight) {
        // https://en.wikipedia.org/wiki/Critters_(block_cellular_automaton)
        const cg = this.currentGrid;
        const sg = this.scratchGrid;
        switch (this.transitionRule.blockAction(this, topLeft, topRight, bottomLeft, bottomRight)) {
            case BlockAction.NOOP:
                sg[topLeft] = cg[topLeft];
                sg[topRight] = cg[topRight];
                sg[bottomLeft] = cg[bottomLeft];
                sg[bottomRight] = cg[bottomRight];
                break;
            case BlockAction.INVERT:
                sg[topLeft] = 1 - cg[topLeft];
                sg[topRight] = 1 - cg[topRight];
                sg[bottomLeft] = 1 - cg[bottomLeft];
                sg[bottomRight] = 1 - cg[bottomRight];
                break;
            case BlockAction.ROTATE_180:
                sg[topLeft] = cg[bottomRight];
                sg[topRight] = cg[bottomLeft];
                sg[bottomLeft] = cg[topRight];
                sg[bottomRight] = cg[topLeft];
                break;
            case BlockAction.ROTATE_90:
                sg[topLeft] = cg[topRight];
                sg[topRight] = cg[bottomRight];
                sg[bottomLeft] = cg[topLeft];
                sg[bottomRight] = cg[bottomLeft];
                break;
            case BlockAction.ROTATE_270:
                sg[topLeft] = cg[bottomLeft];
                sg[topRight] = cg[topLeft];
                sg[bottomLeft] = cg[bottomRight];
                sg[bottomRight] = cg[topRight];
                break;
        }
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
                    this._update2x2Block(
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
                    this._update2x2Block(
                        offset, offset + 1,
                        offset + this.numCols, offset + this.numCols + 1);
                }
            }
            // Along bottom row, wrapping to top.
            const lastRowOffset = this.numCols * (this.numRows - 1);
            for (let c = 1; c < this.numCols - 1; c += 2) {
                this._update2x2Block(
                    lastRowOffset + c, lastRowOffset + c + 1,
                    c, c + 1);
            }
            // Along right edge, wrapping to left.
            for (let r = 1; r < this.numRows - 1; r += 2) {
                const rowOffset = r * this.numCols;
                this._update2x2Block(
                    rowOffset + this.numCols - 1, rowOffset,
                    rowOffset + 2 * this.numCols - 1, rowOffset + this.numCols);
            }
            // "Top left" at bottom right, wrapping to the other corners.
            this._update2x2Block(
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

export const Rules = {
    // https://en.wikipedia.org/wiki/Critters_(block_cellular_automaton)
    // We use the variation that has different transitions for even and odd frames.
    // This preserves the number of active cells.
    CRITTERS: {
        name: 'Critters',
        blockAction(ca, topLeft, topRight, bottomLeft, bottomRight) {
            const cg = ca.currentGrid;
            const numAlive = cg[topLeft] + cg[topRight] + cg[bottomLeft] + cg[bottomRight];
            if (numAlive === 2) {
                return BlockAction.INVERT;
            }
            if ((numAlive === 1 && !ca.useEvenGrid()) || (numAlive === 3 && ca.useEvenGrid())) {
                return BlockAction.ROTATE_180;
            }
            return BlockAction.NOOP;
        },
    },

    // https://en.wikipedia.org/wiki/Reversible_cellular_automaton#Synchronization
    // The "official" Tron rule inverts a block if none or all of the cells are active.
    // That causes lots of flashing, so we do the opposite and invert if between 1 and 3
    // are active. This is equivalent to applying the none/all rule and then inverting the
    // entire grid, so the overall behavior is the same.
    TRON: {
        name: 'Tron',
        blockAction(ca, topLeft, topRight, bottomLeft, bottomRight) {
            const cg = ca.currentGrid;
            const numAlive = cg[topLeft] + cg[topRight] + cg[bottomLeft] + cg[bottomRight];
            return (numAlive == 0 || numAlive == 4) ? BlockAction.NOOP : BlockAction.INVERT;
        },
    },

    // https://www.mitpressjournals.org/doi/pdf/10.1162/978-0-262-32621-6-ch084
    HIGHLANDER: {
        name: 'Highlander',
        blockAction(ca, topLeft, topRight, bottomLeft, bottomRight) {
            const cg = ca.currentGrid;
            const numAlive = cg[topLeft] + cg[topRight] + cg[bottomLeft] + cg[bottomRight];
            switch (numAlive) {
                case 2:
                    return BlockAction.INVERT;
                case 1:
                    return ca.isReversed ? BlockAction.ROTATE_270 : BlockAction.ROTATE_90;
                case 3:
                    return ca.isReversed ? BlockAction.ROTATE_90 : BlockAction.ROTATE_270;
                default:
                    return BlockAction.NOOP;
            }
        },
    },

    // https://en.wikipedia.org/wiki/Reversible_cellular_automaton#Billiard_ball_computation_and_low-power_computing
    // http://fab.cba.mit.edu/classes/862.16/notes/computation/Margolus-1984.pdf
    BILLIARD_BALL: {
        name: 'Billiard ball',
        blockAction(ca, topLeft, topRight, bottomLeft, bottomRight) {
            const cg = ca.currentGrid;
            const numAlive = cg[topLeft] + cg[topRight] + cg[bottomLeft] + cg[bottomRight];
            if (numAlive === 1) {
                return BlockAction.ROTATE_180;
            }
            if (numAlive === 2 && cg[topLeft] === cg[bottomRight]) {
                return BlockAction.INVERT;
            }
            return BlockAction.NOOP;
        },
    },

    // https://web.mit.edu/lrs/www/physCA/
    SCHAEFFER: {
        name: 'Schaeffer',
        blockAction(ca, topLeft, topRight, bottomLeft, bottomRight) {
            const cg = ca.currentGrid;
            const numAlive = cg[topLeft] + cg[topRight] + cg[bottomLeft] + cg[bottomRight];
            return (numAlive === 1 || numAlive === 2) ? BlockAction.ROTATE_180 : BlockAction.NOOP;
        },
    },
};
