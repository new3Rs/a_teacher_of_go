/**
 * @preserve Copyright 2020 ICHIKAWA, Yuji (New 3 Rs)
 */

import React, { Component, RefObject } from "react";
import Modal from "react-modal";
import { random, sleep } from "./utilities";
import AlleloBoard from "./AlleloBoard";
import { GoPosition, GoPlayMove, BLACK, PASS, xy2coord, coord2xy } from "./GoPosition";
import Gtp from "./Gtp";

interface Props {}
interface State {
    percent: number;
    black: string;
    white: string;
    turn: number;
    candidates: any[];
    ownership: any[];
    modalIsOpen: boolean;
    modalStyle: any;
    modalMessage: string;
    buttonMessage: string;
}

class GoBoardController extends Component<Props, State> {
    size: number;
    byoyomi: number;
    model: GoPosition;
    gtp: Gtp;
    boardRef: RefObject<AlleloBoard>;
    modalRef: React.RefObject<Modal>;
    handicap: number;
    yourTurn: number;

    constructor(props: Props) {
        super(props);
        this.boardRef = React.createRef();
        this.size = 7;
        this.byoyomi = 3;
        this.handicap = 5;
        this.yourTurn = BLACK;
        this.model = new GoPosition(this.size, this.size);
        this.state = {
            percent: 50,
            black: "",
            white: "",
            turn: BLACK,
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
            buttonMessage: "とじる",
        }
        this.gtp = Gtp.shared;
       this.closeModal = this.closeModal.bind(this);
       this.modalRef = React.createRef();
    }

    render() {
        const paragraphs = [];
        for (const [i, m] of this.state.modalMessage.split("\n").entries()) {
            paragraphs.push(<p key={`gbc-p-${i}`}>{m}</p>);
        }
        return (
            <div>
                <p className="align-center">{this.state.turn === this.yourTurn ? "あなたのばん" : "わたしのばん"}</p>
                <AlleloBoard ref={this.boardRef} position={this.model} onClick={async (x: number, y: number) => await this.onClick(x, y)} />
                <div className="align-center">
                    <button className="button" onClick={() => { this.pass(); }}>パス</button>
                    <button className="button" onClick={() => { this.resign(); }}>あきらめる</button>
                </div>
                <Modal
                    ref={this.modalRef}
                    isOpen={this.state.modalIsOpen}
                    onRequestClose={this.closeModal}
                    style={this.state.modalStyle}
                    contentLabel="セリフ"
                >
                    <h2>いごのせんせい</h2>
                    {paragraphs}
                    <button onClick={this.closeModal}>{this.state.buttonMessage}</button>
                </Modal>
            </div>
        );
    }

    async loadWeight() {
        // webglバックエンドだとウェイトのロードに時間がかかって初回のpredictが遅いのでここで一度ロードしておく。
        await this.gtp.command(`time_settings 0 1 1`);
        await this.gtp.command("genmove black");
    }

    async setRule() {
        await this.gtp.command("komi 0");
        await this.gtp.command(`time_settings 0 ${this.byoyomi} 1`);
    }

    async resetBoard() {
        await this.gtp.command("clear_board");
        this.model.clear();
        await this.boardRef?.current?.clear();
        this.setState({ turn: this.model.turn });
    }

    async startGame() {
        if (this.handicap >= 2) {
            for (let n = 0; n < this.handicap; n++) {
                for (;;) {
                    try {
                        this.model.turn = BLACK;
                        const x = random(this.model.WIDTH) + 1;
                        const y = random(this.model.HEIGHT) + 1;
                        await this.gtp.command(`play black ${xy2coord(x, y)}`);
                        await this.play(x, y);
                        break;
                    } catch (e) {
    
                    }
                }
            }
            await this.enginePlay();
        }
    }

    async onClick(x: number, y: number): Promise<void> {
        let turn = this.model.turn;
        if (turn !== this.yourTurn) {
            return;
        }
        const result = await this.play(x, y);
        if (result == null) {
            return;
        }
        try {
            if (!(result.captives.length === 1 && result.captives[0] === result.point)) { // 一子自殺手でなければ
                await this.gtp.command(`play ${turn === BLACK ? "black" : "white"} ${xy2coord(x, y)}`);
            }
            await this.enginePlay();
        } catch (e) {
            console.log(e);
        }
    }

    async enginePlay() {
        const turn = this.model.turn;
        const move = await this.gtp.command(`genmove ${turn === BLACK ? "black" : "white"}`);
        if (move === "= resign") {
            await new Promise((res, rej) => {
                this.setState((state: State, props: Props): any => {
                    let message = "あきらめます。まけました。";
                    if (this.handicap > 1) {
                        this.handicap -= 1;
                    } else {
                        message += "\nつよい！もうおしえることはありません。\nこのちょうしで、いごのみちをまいしんしてください！"
                    }
                    return {
                        modalIsOpen: true,
                        modalMessage: message + "\nもう1ゲームしますか？",
                        buttonMessage: "はい",
                    }
                });
            });
        } else if (move === "= pass") {
            this.model.play(PASS);
            this.setState({ turn: this.model.turn });
            if (this.model.passes < 2) {
                this.setState((state: State, props: Props): any => {
                    return {
                        modalIsOpen: true,
                        modalMessage: "パスします\n(からすことができる きみどりは ぜんぶ からせてください。\nからすことができる きみどりがなくなったら パスしてください)",
                        buttonMessage: "とじる",
                    }
                });
            } else {
                await this.makeScore();
            }
        } else {
            const match = move.match(/^= ([A-Z][0-9]{1,2})/);
            if (match) {
                const xy = coord2xy(match[1]);
                await this.play(xy[0], xy[1]);
            }
        }
    }

    async play(x: number, y: number): Promise<GoPlayMove | null> {
        const result = this.model.play(this.model.xyToPoint(x, y));
        if (result != null) {
            await this.boardRef.current?.play(this.model, x, y, result);
            this.setState({ turn: this.model.turn });
            await sleep(0); // ここで1度event loopを手放さないとリーフが描画されないままエンジンが動いてしまう
        }
        return result;
    }

    async pass(): Promise<void> {
        if (this.model.turn === this.yourTurn) {
            this.model.play(PASS);
            if (this.model.passes < 2) {
                this.setState({ turn: this.model.turn });
                await this.enginePlay();
            } else {
                await this.makeScore();
            }
        }
    }

    async resign(): Promise<void> {
        if (this.model.turn === this.yourTurn) {
            this.handicap += 1;
            this.setState({
                modalIsOpen: true,
                modalMessage: "ありがとうございました\nもう1ゲームしますか？",
                buttonMessage: "はい",
            });
        }
    }

    async closeModal(): Promise<void> {
        this.setState({ modalIsOpen: false });
        if (this.state.buttonMessage === "はい") {
            await this.resetBoard();
            await this.startGame();
        }
    }

    async makeScore(): Promise<void> {
        const result = await this.gtp.command("final_score");
        let message = "";
        if (result === "= 0") {
            message = "ひきわけですね";
        } else {
            const match = result.match(/^= (B|W)\+([0-9]+)/);
            if (match) {
                if (match[1] === (this.yourTurn === BLACK ? "B" : "W")) {
                    message = `あなたの ${match[2]}つ かちですか？\nまけました。つよいですね`;
                    if (this.handicap > 0) {
                        this.handicap -= 1;
                    }
                } else {
                    message = `わたしの ${match[2]}つ かちですか`
                    this.handicap += 1;
                }
            } else {
                throw new Error("should not reach here");
            }
        }
        this.setState({
            modalIsOpen: true,
            modalMessage: message + "\nもう1ゲームしますか？",
            buttonMessage: "はい",
        });
    }
}

export default GoBoardController;
