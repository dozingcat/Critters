export class AnimationStep {
    constructor(rule, numTicks, durationMillis, color) {
        this.transitionRule = rule;
        this.numTicks = numTicks;
        this.durationMillis = durationMillis;
        this.color = color;
    }

    reversed() {
        return new AnimationStep(
            this.transitionRule, -this.numTicks, this.durationMillis, this.color);
    }
}

export class Animation {
    constructor(steps) {
        this.steps = steps.slice();
    }

    addStepAtIndex(step, index) {
        this.steps.splice(index, 0, step);
    }

    removeStepAtIndex(index) {
        this.steps.splice(index, 1);
    }

    reversed() {
        const revSteps = [];
        for (let i = this.steps.length - 1; i >= 0; i--) {
            revSteps.push(this.steps[i].reversed());
        }
        return new Animation(revSteps);
    }
}
