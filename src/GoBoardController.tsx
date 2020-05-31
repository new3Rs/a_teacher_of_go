/**
 * @preserve Copyright 2020 ICHIKAWA, Yuji (New 3 Rs)
 */
/* global FS */

import React, { Component, RefObject } from "react";
import Modal from "react-modal";
import AlleloBoard from "./AlleloBoard";
import { GoPosition, BLACK, WHITE, xy2coord, coord2xy } from "./GoPosition";
import Gtp from "./Gtp";

function random(n: number) {
    return Math.floor(Math.random() * n);
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
    modalIsOpen: boolean;
    modalStyle: any;
    modalMessage: string;
}

class GoBoardController extends Component<Props, State> {
    size: number;
    byoyomi: number;
    gtp: Gtp;
    boardRef: RefObject<AlleloBoard>;
    modalRef: React.RefObject<Modal>;
    handicap: number;

    constructor(props: Props) {
        super(props);
        this.boardRef = React.createRef();
        this.size = 7;
        this.byoyomi = 3;
        this.handicap = 9;
        this.state = {
            percent: 50,
            black: "",
            white: "",
            model: new GoPosition(this.size, this.size),
            candidates: [],
            ownership: [],
            modalIsOpen: false,
            modalStyle: {
                content: {
                    top: '50%',
                    left: '50%',
                    right: 'auto',
                    bottom: 'auto',
                    marginRight: '-50%',
                    transform: 'translate(-50%, -50%)'
                }
            },
            modalMessage: "こんにちは！すこし まってね",
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
       this.onAfterOpenModal = this.onAfterOpenModal.bind(this);
       this.closeModal = this.closeModal.bind(this);
       this.modalRef = React.createRef();
    }

    render() {
        const paragraphs = [];
        for (const m of this.state.modalMessage.split("\n")) {
            paragraphs.push(<p>{m}</p>);
        }
        return (
            <div>
                <p>{this.state.model.turn == BLACK ? "あなたのばん" : "わたしのばん"}</p>
                <AlleloBoard ref={this.boardRef} position={this.state.model} onClick={async (x: number, y: number) => await this.onClick(x, y)} />
                <Modal
                    ref={this.modalRef}
                    isOpen={this.state.modalIsOpen}
                    onAfterOpen={this.onAfterOpenModal}
                    onRequestClose={this.closeModal}
                    style={this.state.modalStyle}
                    contentLabel="セリフ"
                >
                    <h2>いごのせんせい</h2>
                    {paragraphs}
                    <button onClick={this.closeModal}>もう1ゲーム</button>
                </Modal>
            </div>
        );
    }

    async setRule() {
        await this.gtp.command("komi 0");
        await this.gtp.command("time_settings 0 3 1");
    }

    async resetBoard() {
        await this.gtp.command("clear_board");
        await new Promise((res, rej) => {
            this.setState((state: State, props: Props): any => {
                state.model.clear();
                res();
                return { model: state.model };
            });
        });
}
    async startGame() {
        for (let n = 0; n < this.handicap; n++) {
            for (;;) {
                try {
                    this.state.model.turn = BLACK;
                    const x = random(this.state.model.WIDTH) + 1;
                    const y = random(this.state.model.HEIGHT) + 1;
                    await this.gtp.command(`play black ${xy2coord(x, y)}`);
                    await this.play(x, y);
                    break;
                } catch (e) {

                }
            }
        }
        await this.enginePlay();
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
        if (!await this.play(x, y)) {
            return;
        }
        try {
            await this.gtp.command(`play ${turn === BLACK ? "black" : "white"} ${xy2coord(x, y)}`);
            await this.enginePlay();
        } catch (e) {
            console.log(e);
        }
    }

    async enginePlay() {
        const turn = this.state.model.turn;
        const move = await this.gtp.command(`genmove ${turn === BLACK ? "black" : "white"}`);
        if (move === "= resign") {
            await new Promise((res, rej) => {
                this.setState((state: State, props: Props): any => {
                    if (this.handicap > 0) {
                        this.handicap -= 1;
                    }
                    return {
                        modalIsOpen: true,
                        modalMessage: "あきらめます。まけました。\nもう1ゲームしますか？"
                    }
                });
            });
        } else if (move === "= pass") {
            const result = await this.gtp.command("final_score");
            let message = "";
            if (result === "= Jigo") {
                message = "ひきわけですね"
            } else {
                const match = result.match(/^= (B|W)\+([0-9]+)/);
                if (match) {
                    if (match[1] === "B") {
                        message = "まけました。つよいですね"
                        if (this.handicap > 0) {
                            this.handicap -= 1;
                        }
                    } else {
                        message = `わたしが${match[2]}つ かちですか`
                        this.handicap += 1;
                    }
                } else {
                    console.log(result);
                    alert("?");
                    return;
                }
            }
            await new Promise((res, rej) => {
                this.setState((state: State, props: Props): any => {
                    return {
                        modalIsOpen: true,
                        modalMessage: message + "\nもう1ゲームしますか？"
                    }
                });
            });
        } else {
            const match = move.match(/^= ([A-Z][0-9]{1,2})/);
            if (match) {
                const xy = coord2xy(match[1]);
                await this.play(xy[0], xy[1]);
            }
        }
    }

    async play(x: number, y: number): Promise<Boolean> {
        try {
            const result = await new Promise((res, rej) => {
                this.setState((state: State, props: Props): any => {
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

    onAfterOpenModal() {

    }

    async closeModal(): Promise<any> {
        this.setState({ modalIsOpen: false });
        await this.resetBoard();
        await this.startGame();
    }
}

export default GoBoardController;
