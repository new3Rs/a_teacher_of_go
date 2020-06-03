/**
 * @preserve Copyright 2020 ICHIKAWA, Yuji (New 3 Rs)
 */

 import React, { Component } from 'react';
import Modal from "react-modal";
import GoBoardController from './GoBoardController';

declare global {
    interface Window { controller: App; }
}

Modal.setAppElement("#app-container");

interface Props {}
interface State {
    isLoading: boolean;
    modalIsOpen: boolean;
    modalMessage: string;
    modalStyle: any;
}

class App extends Component<Props, State> {
    controllerRef: React.RefObject<GoBoardController>;
    modalRef: React.RefObject<Modal>;

    constructor(props: Props) {
        super(props);
        this.controllerRef = React.createRef();
        this.modalRef = React.createRef();
        this.state = {
            isLoading: true,
            modalIsOpen: true,
            modalMessage: "こんにちは！すこし まってね",
            modalStyle: {
                content: {
                    top: '50%',
                    left: '50%',
                    right: 'auto',
                    bottom: 'auto',
                    marginRight: '-50%',
                    transform: 'translate(-50%, -50%)'
                }
            }
        }
        this.start = this.start.bind(this);
        // katagoStatusHandlerでready時に操作するためにグローバル変数にする
        window.controller = this;
    }

    render() {
        const paragraphs = [];
        for (const [i, m] of this.state.modalMessage.split("\n").entries()) {
            paragraphs.push(<p key={`app-p-${i}`}>{m}</p>);
        }
        return (
            <div className="container">
                <GoBoardController ref={this.controllerRef} />
                <Modal
                    ref={this.modalRef}
                    isOpen={this.state.modalIsOpen}
                    style={this.state.modalStyle}
                    contentLabel="あいさつとルール"
                >
                    <h2>いごのせんせい</h2>
                    {paragraphs}
                    {this.state.isLoading ? undefined : <button onClick={this.start}>はじめる</button>}
                </Modal>
            </div>
        )
    }

    onReady() {
        this.setState({
            isLoading: false,
            modalMessage: "みどりをふやすゲームをしましょう\nあなたはこいみどり、わたしはきみどりです\nはたけのなかにたくさん みどりをふやしたほうがかちです\nはっぱをぜんぶかくされると かれます\nでは、やってみましょう"
        });
    }

    async start() {
        this.closeModal();
        await this.controllerRef.current?.setRule();
        await this.controllerRef.current?.startGame();
    }

    closeModal() {
        this.setState({ modalIsOpen: false });
    }
}

export default App;
