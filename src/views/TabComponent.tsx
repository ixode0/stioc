import {SessionComponent} from "./SessionComponent";
import * as React from "react";
import {SessionID} from "../shell/Session";

type Props = {
    sessionIDs: SessionID[];
    focusedSessionID: SessionID;
    isFocused: boolean;
    onSessionFocus: (id: SessionID) => void
};

export class TabComponent extends React.Component<Props, {}> {
    sessionComponents!: SessionComponent[];
    focusedSessionComponent: SessionComponent | undefined;

    render() {
        this.sessionComponents = [];
        const sessionComponents = this.props.sessionIDs.map((id, index) => {
            const isFocused = this.props.isFocused && id === this.props.focusedSessionID;

            return (
                <SessionComponent
                    sessionID={id}
                    key={id}
                    ref={sessionComponent => {
                        // Unmount.
                        if (!sessionComponent) {
                            return;
                        }

                        if (isFocused) {
                            this.focusedSessionComponent = sessionComponent!;
                        }
                        this.sessionComponents[index] = sessionComponent!;
                    }}
                    isFocused={isFocused}
                    focus={() => {
                        this.props.onSessionFocus(id);
                        this.forceUpdate();
                    }}>
                </SessionComponent>
            );
        });

        return (
            <div className="tab" data-focused={this.props.isFocused}>
                {/* #372 split screen: side-by-side when exactly 2 sessions; CSS grid uses data-side-by-side=true -> 1fr 1fr */}
                {/* #385 contain:layout on .session prevents xterm overlap when split */}
                <div className="sessions" data-side-by-side={this.props.sessionIDs.length === 2}>
                    {sessionComponents}
                </div>
            </div>
        );
    }
}
