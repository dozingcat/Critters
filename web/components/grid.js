export const GridComponent = Vue.extend({
    template: `<div class="grid"><canvas ref="canvas"></canvas></div>`,

    props: ['state'],

    data: () => ({
        canvas: null,
        ctx: null,
        dragState: null,  // Boolean tri-state, true for turning cells on, false for off.
    }),

    mounted() {
        this.canvas = this.$refs['canvas'];
        this.ctx = this.canvas.getContext('2d');
        this.state.addGridCallback(() => this.draw());
        this.canvas.addEventListener('mousedown', e => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', e => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', e => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', e => this.stopDrawing());
        this.resize();
    },

    methods: {
        pixelsPerCell() {
            const ca = this.state.ca;
            return Math.min(this.canvas.width / ca.numCols, this.canvas.height / ca.numRows);
        },

        resize() {
            const rect = this.$el.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.draw();
        },

        draw() {
            const ctx = this.ctx;
            const ca = this.state.ca;
            ctx.save();
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = 'green';
            const pixelsPerCell = this.pixelsPerCell();

            const drawLine = (x1, y1, x2, y2) => {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            };

            if (this.state.showSubgrids) {
                const oddFrame = !this.state.isRunning() && ca.frameNumber % 2 === 1;
                ctx.strokeStyle = oddFrame ? 'rgb(64, 64, 64)' : 'rgb(128, 128, 128)';
                for (let r = 2; r < ca.numRows; r += 2) {
                    drawLine(0, r * pixelsPerCell, this.canvas.width, r * pixelsPerCell);
                }
                for (let c = 2; c < ca.numCols; c += 2) {
                    drawLine(c * pixelsPerCell, 0, c * pixelsPerCell, this.canvas.height);
                }
                ctx.strokeStyle = oddFrame ? 'rgb(128, 128, 128)' : 'rgb(64, 64, 64)';
                ctx.setLineDash([8, 4]);
                for (let r = 1; r < ca.numRows; r += 2) {
                    drawLine(0, r * pixelsPerCell, this.canvas.width, r * pixelsPerCell);
                }
                for (let c = 1; c < ca.numCols; c += 2) {
                    drawLine(c * pixelsPerCell, 0, c * pixelsPerCell, this.canvas.height);
                }
            }

            for (let r = 0; r < ca.numRows; r++) {
                const y = pixelsPerCell * r;
                for (let c = 0; c < ca.numCols; c++) {
                    if (ca.at(r, c)) {
                        // TODO: custom colors
                        ctx.fillRect(
                            pixelsPerCell * c + 0.5, y + 0.5, pixelsPerCell - 1, pixelsPerCell - 1);
                    }
                }
            }

            const rev = ca.isReversed ? 'R' : '';
            ctx.fillStyle = 'white';
            ctx.fillText(String(ca.frameNumber) + rev, 20, 20);
            ctx.restore();
        },

        _cellAtEventLocation(event) {
            const canvasRect = this.canvas.getBoundingClientRect();
            const pixelsPerCell = this.pixelsPerCell();
            const ca = this.state.ca;
            const col = Math.floor((event.clientX - canvasRect.left) / pixelsPerCell);
            const row = Math.floor((event.clientY - canvasRect.top) / pixelsPerCell);
            if (col >= 0 && col < ca.numCols && row>= 0 && row < ca.numRows) {
                return [row, col];
            }
            return null;
        },

        handleCanvasClick(event) {
            if (!this.state.isDrawModeEnabled()) {
                return;
            }
            const rc = this._cellAtEventLocation(event);
            if (rc) {
                this.state.toggleCell(rc[0], rc[1]);
                this.dragState = this.state.ca.at(rc[0], rc[1]);
            }
        },

        handleCanvasMouseMove(event) {
            if (this.dragState == null) {
                return;
            }
            const rc = this._cellAtEventLocation(event);
            if (rc) {
                this.state.setCell(rc[0], rc[1], this.dragState);
            }
        },

        stopDrawing() {
            this.dragState = null;
        },
    },
});
