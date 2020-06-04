/**
 * @preserve Copyright 2020 ICHIKAWA, Yuji (New 3 Rs)
 */

 export function random(n: number) {
    return Math.floor(Math.random() * n);
}

export async function sleep(n: number): Promise<void> {
    return new Promise(function(res, rej) {
        setTimeout(res, n);
    });
}

