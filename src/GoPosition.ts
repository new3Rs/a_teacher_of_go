/**
 * @preserve Copyright 2020 ICHIKAWA, Yuji (New 3 Rs)
 */
import jssgf from "jssgf";

export const PASS = -1;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const BAN = 3;


export function coord2xy(coord: string): [number, number] {
    const c = coord.charCodeAt(0);
    const x = (c < "I".charCodeAt(0) ? c + 1 : c) - "A".charCodeAt(0);
    return [x, parseInt(coord.slice(1))];
}

export function xy2coord(x: number, y: number): string {
    const COORD = ["@", "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"];
    return COORD[x] + y;
}

/**
 * 相手のカラーを返す。
 * @param {Integer} color 
 * @returns {Integer}
 */
function opponentOf(color: number): number {
    switch (color) {
        case BLACK:
            return WHITE;
        case WHITE:
            return BLACK;
        default:
            return EMPTY;
    }
}

/** 盤上を再帰的に処理するときに処理済みかチェックするためのヘルパークラス */
class Marker {
    value: number;
    marks: Int32Array;
    
    constructor(size: number) {
        this.value = 0;
        this.marks = new Int32Array(size);
    }

    clear() {
        this.value += 1;
    }

    isMarked(point: number): boolean {
        return this.marks[point] === this.value;
    }

    mark(point: number) {
        this.marks[point] = this.value;
    }
}

export class GoPosition {
    WIDTH: number;
    HEIGHT: number;
    LENGTH: number;
    marker1: Marker;
    marker2: Marker;
    state: Uint8Array;
    turn: number;
    ko: number | null;
    passes: number;

    static copy(source: GoPosition): GoPosition {
        const result = new GoPosition(source.WIDTH, source.HEIGHT);
        result.state.set(source.state);
        result.turn = source.turn;
        result.ko = source.ko;
        result.passes = source.passes;
        return result;
    }

    static fromSgf(sgf: string): GoPosition {
        const [root] = jssgf.fastParse(sgf);
        let width = 19;
        let height = 19;
        if (root.SZ) {
            if (/^[0-9]{1,2}$/.test(root.SZ)) {
                width = parseInt(root.SZ);
                height = width;
            } else {
                const match = root.SZ.match(/^([0-9]{1,2}):([0-9]{1,2})$/);
                if (match) {
                    width = parseInt(match[1]);
                    height = parseInt(match[2]);
                }
            }
        }
        const p = new this(width, height);
        let node = root;
        while (node._children.length > 0) {
            node = node._children[0];
            let move;
            if (node.B != null) {
                move = node.B;
            } else if (node.W != null) {
                move = node.W;
            } else {
                continue;
            }
            p.play(p.xyToPoint.apply(p, p.moveToXy(move)));
        }
        return p
    }

    constructor(width: number, height: number) {
        this.WIDTH = width;
        this.HEIGHT = height;
        this.LENGTH = this.WIDTH * this.HEIGHT;
        this.state = new Uint8Array(this.LENGTH);
        this.turn = BLACK;
        this.marker1 = new Marker(this.LENGTH);
        this.marker2 = new Marker(this.LENGTH);
        this.ko = null;
        this.passes = 0;
    }

    clear() {
        this.state = new Uint8Array(this.LENGTH);
        this.turn = BLACK;
        this.ko = null;
        this.passes = 0;
    }

    opponent(): number {
        return opponentOf(this.turn);
    }

    switchTurn() {
        this.turn = opponentOf(this.turn);
    }

    getState(point: number): number {
        return this.state[point];
    }

    setState(point: number, color: number) {
        this.state[point] = color;
    }

    removeString(string: GoString) {
        for (const e of string.points) {
            this.setState(e, EMPTY);
        }
    }

    captureBy(point: number): number[] {
        const opponent = this.opponent();
        const captives: number[] = [];
        for (const pt of this.adjacenciesAt(point)) {
            if (this.getState(pt) === opponent) {
                const string = this.stringAt(pt);
                if (string && string.liberties.length === 0) {
                    this.removeString(string);
                    captives.push.apply(captives, string.points);
                }
            }
        }
        return captives;
    }

    stringAt(point: number): GoString | null {
        const color = this.getState(point);
        if (color === EMPTY || color === BAN) {
            return null;
        }
        const opponent = opponentOf(color);
        const string = new GoString();

        this.marker1.clear();
        this.marker2.clear();
        string.points.push(point);
        this.marker2.mark(point);
        for (let index = 0; index < string.points.length; index++) {
            const pt = string.points[index];
            if (!this.marker1.isMarked(pt)) {
                this.marker1.mark(pt);
                for (const a of this.adjacenciesAt(pt)) {
                    if (!this.marker1.isMarked(a)) {
                        const state = this.getState(a);
                        if (state === color) {
                            if (!this.marker2.isMarked(a)) {
                                string.points.push(a);
                                this.marker2.mark(a);
                            }
                        } else {
                            this.marker1.mark(a);
                            if (state === opponent) {
                                string.opponents.push(a);
                            } else if (state === EMPTY) {
                                string.liberties.push(a);
                            }
                        }
                    }
                }
            }
        }
        return string;
    }

    connectedEmptiesAt(point: number): GoConnectedEmpties | null {
        if (this.getState(point) !== EMPTY) {
            return null;
        }
        const empties = new GoConnectedEmpties();

        this.marker1.clear();
        this.marker2.clear();
        empties.points.push(point);
        this.marker2.mark(point);
        for (let index = 0; index < empties.points.length; index++) {
            const pt = empties.points[index];
            if (!this.marker1.isMarked(pt)) {
                this.marker1.mark(pt);
                for (const a of this.adjacenciesAt(pt)) {
                    if (!this.marker1.isMarked(a)) {
                        const state = this.getState(a);
                        if (state === EMPTY) {
                            if (!this.marker2.isMarked(a)) {
                                empties.points.push(a);
                                this.marker2.mark(a);
                            }
                        } else {
                            this.marker1.mark(a);
                            if (state === BLACK) {
                                empties.blacks.push(a);
                            } else if (state === WHITE) {
                                empties.whites.push(a);
                            }
                        }
                    }
                }
            }
        }
        return empties;
    }

    play(point: number): GoPlayMove | null {
        const turn = this.turn;
        const ko = this.ko;
        if (point === PASS) {
            this.passes += 1;
            this.ko = null;
            this.switchTurn();
            return new GoPlayMove(turn, point, ko, [], null);
        } else if (this.getState(point) !== EMPTY) { // 着手禁止
            return null;
        }
        this.passes = 0;
        if (point === ko) {
            this.ko = null;
            this.switchTurn();
            return new GoPlayMove(turn, point, ko, [point], null);
        }
        this.setState(point, this.turn);
        const captives = this.captureBy(point);
        const string = this.stringAt(point);
        if (string == null) {
            throw new Error("should not reach here");
        }
        const liberties = string.liberties.length;
        if (captives.length === 1 && liberties === 1 && string.points.length === 1) {
            this.ko = string.liberties[0];
        } else {
            this.ko = null;
        }
        this.switchTurn();
        if (liberties === 0) {
            for (const e of string.points) {
                this.setState(e, EMPTY);
            }
            return new GoPlayMove(turn, point, ko, string.points, null);
        } else {
            return new GoPlayMove(turn, point, ko, captives, string);
        }
    }

    undoPlay(move: GoPlayMove) {
        this.ko = move.ko;
        this.switchTurn();
        if (move.point === PASS) {
            return;
        }
        if (move.captives.includes(move.point)) {
            for (const p of move.captives) {
                this.setState(p, move.turn);
            }
        } else {
            const opponent = opponentOf(move.turn);
            for (const p of move.captives) {
                this.setState(p, opponent);
            }
        }
        this.setState(move.point, EMPTY);
    }

    isLegal(point: number): boolean {
        const move = this.play(point);
        if (move) {
            this.undoPlay(move);
            return true;
        }
        return false;
    }

    xyToPoint(x: number, y: number): number {
        return (x - 1) + (y - 1) * this.WIDTH;
    }

    pointToXy(point: number): [number, number] {
        const y = Math.floor(point / this.WIDTH);
        const x = point - y * this.WIDTH;
        return [x + 1, y + 1];
    }

    moveToXy(move: string): [number, number] {
        const OFFSET = "a".charCodeAt(0) - 1;
        return [move.charCodeAt(0) - OFFSET, move.charCodeAt(1) - OFFSET];
    }

    adjacenciesAt(point: number): number[] {
        const xy = this.pointToXy(point);
        const result = [];
        for (const e of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const x = xy[0] + e[0];
            const y = xy[1] + e[1];
            if (x >= 1 && x <= this.WIDTH && y >= 1 && y <= this.HEIGHT) {
                result.push(this.xyToPoint(x, y));
            }
        }
        return result;
    }

    diagonalsAt(point: number): number[] {
        const xy = this.pointToXy(point);
        const result = [];
        for (const e of [[-1, -1], [-1, 1], [1, -1], [1, -1]]) {
            const x = xy[0] + e[0];
            const y = xy[1] + e[1];
            if (x >= 1 && x <= this.WIDTH && y >= 1 && y <= this.HEIGHT) {
                result.push(this.xyToPoint(x, y));
            }
        }
        return result;
    }

    toString() {
        let string ='';
        for (let y = 1; y <= this.HEIGHT; y++) {
            for (let x = 1; x <= this.WIDTH; x++) {
                switch (this.getState(this.xyToPoint(x, y))) {
                    case BAN:
                        string += '#';
                        break;
                    case EMPTY:
                        string += '.';
                        break;
                    case BLACK:
                        string += 'X';
                        break;
                    case WHITE:
                        string += 'O';
                        break;
                    default:
                }
            }
            string += '\n';
        }
        return string;
    }
}

class GoString {
    points: number[];
    liberties: number[];
    opponents: number[];

    constructor() {
        this.points = [];
        this.liberties = [];
        this.opponents = [];
    }
}

class GoConnectedEmpties {
    points: number[];
    blacks: number[];
    whites: number[];

    constructor() {
        this.points = [];
        this.blacks = [];
        this.whites = [];
    }
}

export class GoPlayMove {
    turn: number;
    point: number;
    ko: number | null;
    captives: number[];
    string: GoString | null;

    constructor(turn: number, point: number, ko: number|null, captives: number[], string: GoString | null) {
        this.turn = turn;
        this.point = point;
        this.ko = ko;
        this.captives = captives;
        this.string = string
    }
}