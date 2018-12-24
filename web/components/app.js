import { ControlBarComponent } from './controlbar.js';
import { GridComponent } from './grid.js';

export const AppComponent = Vue.extend({
    template: `
        <div>
            <Grid :state="state" />

            <ControlBar :state="state" />
        </div>
    `,

    components: {
        'ControlBar': ControlBarComponent,
        'Grid': GridComponent,
    },

    props: ['state'],
});
