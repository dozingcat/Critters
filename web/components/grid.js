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
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = 'green';
            const pixelsPerCell = this.pixelsPerCell();
            for (let r = 0; r < ca.numRows; r++) {
                const y = pixelsPerCell * r;
                for (let c = 0; c < ca.numCols; c++) {
                    if (ca.at(r, c)) {
                        // TODO: custom colors
                        ctx.fillRect(pixelsPerCell * c, y, pixelsPerCell, pixelsPerCell);
                    }
                }
            }

            const rev = ca.isReversed ? 'R' : '';
            ctx.fillStyle = 'white';
            ctx.fillText(String(ca.frameNumber) + rev, 20, 20);
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
