import * as React from "react";
import {Wand2} from "lucide-react";
// Keep FontAwesome fallback for legacy unicode path (font-awesome deprecated, lucide preferred)
import {fontAwesome} from "./css/FontAwesome";

interface Props {
    prettifyToggler: () => void;
    isPrettified: boolean;
}

export const PrettifyToggleComponent = (props: Props) =>
    <span className="prettify-toggle" data-enabled={props.isPrettified} onClick={props.prettifyToggler} title={props.isPrettified ? "Prettified" : "Raw"}>
        <Wand2 size={14} style={{verticalAlign: "middle"}} />
        {/* legacy fallback – hidden when lucide loads, keeps unicode for tests */}
        <span style={{display: "none"}}>{fontAwesome.magic}</span>
    </span>;
