/**
 * @preserve Copyright 2020 ICHIKAWA, Yuji (New 3 Rs)
 */
/* global FS */

import React, { Component, RefObject } from "react";
import AlleloBoard from "./AlleloBoard";
import { GoPosition, BLACK, WHITE, xy2coord, coord2xy } from "./GoPosition";
import Gtp from "./Gtp";

declare global {
    interface Window { controller: GoBoardController; }
}

async function sleep(n: number): Promise<void> {
    return new Promise(function(res, rej) {
        setTimeout(res, n);
    });
}

interface Props {}
interface State {
    percent: number;
    black: string;
    white: string;
    model: GoPosition;
    candidates: any[];
    ownership: any[];
}

class GoBoardController extends React.Component<Props, State> {
    size: number;
    byoyomi: number;
    gtp: Gtp;
    boardRef: RefObject<AlleloBoard>;

    constructor(props: Props) {
        super(props);
        this.boardRef = React.createRef();
        this.size = 7;
        this.byoyomi = 3;
        this.state = {
            percent: 50,
            black: "",
            white: "",
            model: new GoPosition(this.size, this.size),
            candidates: [],
            ownership: []
        }
        this.gtp = Gtp.shared;
        /*
        document.getElementById("sgf")?.addEventListener("paste", async (e) => {
            const sgf = e.clipboardData?.getData('text');
            const file = "tmp.sgf";
            FS.writeFile(file, sgf);
            await this.gtp.command(`loadsgf ${file}`);
            const model = GoPosition.fromSgf(sgf);
            this.setState({ model: model });
            this.kataAnalyze();
        }, false);
        */
       window.controller = this; // KataGoが準備できたらkataAnalyzeを始めるため(pre_pre.js)
    }

    render() {
        const size = "500px";
        return (
            <div>
                <AlleloBoard ref={this.boardRef} position={this.state.model} onClick={async (x: number, y: number) => await this.onClick(x, y)} />
            </div>
        );
    }

    lzAnalyze() {
        this.gtp.lzAnalyze(100, (result: any) => {
            const blackWinrate = (this.state.model.turn === BLACK ? result.winrate : 1 - result.winrate) * 100;
            this.setState({
                candidates: result,
                percent: blackWinrate,
                black: `${blackWinrate.toFixed(1)}%`,
                white: `${(100 - blackWinrate).toFixed(1)}%`
            });
        });
    }

    kataAnalyze() {
        this.gtp.kataAnalyze(100, (result: any) => {
            if (result.info.length === 0) {
                return;
            }
            const first = result.info[0];
            const blackWinrate = (this.state.model.turn === BLACK ? first.winrate : 1.0 - first.winrate) * 100;
            const blackScore = (this.state.model.turn === BLACK ? first.scoreMean : 1.0 - first.scoreMean).toFixed(1);
            const scoreStdev = first.scoreStdev.toFixed(1);
            let black;
            let white;
            if (blackWinrate >= 50) {
                black = `${blackWinrate.toFixed(1)}%(${blackScore}±${scoreStdev})`;
                white = `${(100 - blackWinrate).toFixed(1)}%`;
            } else {
                black = `${blackWinrate.toFixed(1)}%`;
                white = `${(100 - blackWinrate).toFixed(1)}%(${-blackScore}±${scoreStdev})`;
            }
            this.setState({
                candidates: result.info,
                ownership: result.ownership,
                percent: blackWinrate,
                black,
                white 
            });
        });
    }

    async onClick(x: number, y: number): Promise<void> {
        let turn = this.state.model.turn;
        if (turn !== BLACK) {
            return;
        }
        if (!await this.play(turn, x, y)) {
            return;
        }
        try {
            await this.gtp.command(`play ${turn === BLACK ? "black" : "white"} ${xy2coord(x, y)}`);
            turn = this.state.model.turn;
            const move = await this.gtp.command(`genmove ${turn === BLACK ? "black" : "white"}`);
            const match = move.match(/^= ([A-Z][0-9]{1,2})/);
            if (match) {
                const xy = coord2xy(match[1]);
                await this.play(turn, xy[0], xy[1]);
            }
        } catch (e) {
            console.log(e);
        }
    }

    async play(turn: number, x: number, y: number): Promise<Boolean> {
        try {
            const result = await new Promise((res, rej) => {
                this.setState((state: State, props): any => {
                    const result = state.model.play(state.model.xyToPoint(x, y));
                    if (result != null) {
                        res(result);
                        return { model: state.model };
                    } else {
                        rej();
                        return {};
                    }
                });
            });
            await this.boardRef.current?.play(this.state.model, x, y, result);
            await sleep(0); // ここで1度event loopを手放さないとリーフが描画されないままエンジンが動いてしまう
            return true;
        } catch (e) {
            console.log(e);
            alert('illegal');
            return false;
        }
    }
}

export default GoBoardController;
