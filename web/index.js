import { AppComponent } from './components/app.js';
import { AppState } from './model/state.js';

(() => {

    const startApp = () => {
        new Vue({
            el: '#app',

            components: {
                'App': AppComponent,
            },

            template: `<App :state="state" />`,

            data: () => ({
                state: new AppState(),
            }),
        });
    };

    window.addEventListener('DOMContentLoaded', startApp);
})();
