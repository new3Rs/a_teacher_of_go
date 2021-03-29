/**
 * @preserve Copyright 2020 ICHIKAWA, Yuji (New 3 Rs)
 */

import React, { RefObject } from "react";
import AlleloBoardElement from "./allelo-board";
import { GoPosition, GoPlayMove, BLACK, WHITE } from "./GoPosition";

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'allelo-board': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
        }
    }
}
AlleloBoardElement.init();

interface Props {
    position: GoPosition;
    onClick: (x: number, y: number) => void;
}
interface State {
    animation: Boolean;
}

class AlleloBoard extends React.Component<Props, State> {
    boardRef: RefObject<AlleloBoardElement>;

    constructor(props: Props) {
        super(props);
        this.boardRef = React.createRef();
        this.state = { animation: false };
    }

    render() {
        let stoneSize = (document.body.clientWidth - 10 * 2 * 2) / this.props.position.WIDTH; // padding 10pxが2重にあるから
        return (
            <allelo-board ref={this.boardRef} data-stone-size={stoneSize} data-width={this.props.position.WIDTH} data-height={this.props.position.HEIGHT}></allelo-board>
        );
    }

    componentDidMount() {
        this.boardRef?.current?.alleloBoard?.addEventListener('click', (x: number, y: number) => {
            this.onClick(x, y);
        });
    }

    componentWillUnmount() {
        this.boardRef?.current?.alleloBoard?.removeEventListener('click', undefined);
    }

    onClick(x: number, y: number) {
        if (this.state.animation) {
            return;
        }
        this.props.onClick(x, y);
    }

    async play(position: GoPosition, x: number, y: number, result: GoPlayMove) {
        if (this.state.animation) {
            return;
        }
        this.setState({ animation: true });
        const index = position.xyToPoint(x, y);
        const state = new Float32Array(position.LENGTH);
        for (let i = 0; i < state.length; i++) {
            switch (position.getState(i)) {
                case BLACK:
                state[i] = 1.0;
                break;
                case WHITE:
                state[i] = -1.0;
                break;
                default:
                state[i] = 0.0;
            }
        }
        await this.boardRef?.current?.alleloBoard?.drawStone(state, result.turn === BLACK ? 1.0 : -1.0, index, result.captives);
        this.setState({ animation: false });
    }

    async clear() {
        const state = new Float32Array(this.props.position.WIDTH * this.props.position.HEIGHT);
        await this.boardRef?.current?.alleloBoard?.drawStone(state, 1.0, null);
    }
}

export default AlleloBoard;
