export const arraysEqual = (a, b) => {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
};

export const swapArrayElements = (arr, index1, index2) => {
    const orig1 = arr[index1];
    const orig2 = arr[index2];
    // Use splice for Vue friendliness.
    arr.splice(index1, 1, orig2);
    arr.splice(index2, 1, orig1);
};

const HEX_CHARS = "0123456789ABCDEF";

const HEX_INDEX_MAP = (() => {
    const m = new Map();
    for (let i = 0; i < HEX_CHARS.length; i++) {
        m.set(HEX_CHARS[i], i);
    }
    return m;
})();

export const intArrayToHex = (arr) => {
    let hex = '';
    for (let i = 0; i < arr.length; i++) {
        const d = arr[i];
        if (!Number.isInteger(d)) {
            throw Error(`Non-integer at index ${i}: ${d}`);
        }
        if (d < 0 || d >= 16) {
            throw Error(`Hex integer out of range at index ${i}: ${d}`);
        }
        hex += HEX_CHARS[d];
    }
    return hex;
};

export const hexToIntArray = (hex) => {
    const ints = [];
    const hUpper = hex.toUpperCase();
    for (let i = 0; i < hex.length; i++) {
        let ch = hUpper[i];
        if (!HEX_INDEX_MAP.has(ch)) {
            throw Error(`Bad hex digit at index ${i}: ${hex[i]}`);
        }
        ints.push(HEX_INDEX_MAP.get(ch));
    }
    return ints;
};
