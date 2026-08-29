import * as monaco from "monaco-editor";
import {leafNodeAt, ASTNode} from "./shell/Parser";
import * as _ from "lodash";
import {Environment} from "./shell/Environment";
import {OrderedSet} from "./utils/OrderedSet";
import {Aliases} from "./shell/Aliases";

type GetSuggestionsOptions = {
    currentText: string;
    currentCaretPosition: number;
    ast: ASTNode;
    environment: Environment;
    historicalPresentDirectoriesStack: OrderedSet<string>;
    aliases: Aliases;
};

export async function getSuggestions({
    currentCaretPosition,
    ast,
    environment,
    historicalPresentDirectoriesStack,
    aliases,
}: GetSuggestionsOptions): Promise<monaco.languages.CompletionList> {
    const node = leafNodeAt(currentCaretPosition, ast);
    const suggestions = await node.suggestions({
        environment: environment,
        historicalPresentDirectoriesStack: historicalPresentDirectoriesStack,
        aliases: aliases,
    });

    const uniqueSuggestions = _.uniqBy(suggestions, suggestion => suggestion.label);

    return {
        incomplete: false,
        suggestions: uniqueSuggestions.map(suggestion => ({
            ...suggestion,
            kind: monaco.languages.CompletionItemKind.Interface,
            insertText: suggestion.insertText ?? suggestion.label,
            range: suggestion.range ?? {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: 1,
                endColumn: 1,
            },
        } as unknown as monaco.languages.CompletionItem)),
    };
}
