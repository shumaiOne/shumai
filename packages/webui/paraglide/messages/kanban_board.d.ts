/**
* | output |
* | --- |
* | "Kanban Board" |
*
* @param {Kanban_BoardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_board: ((inputs?: Kanban_BoardInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Kanban_BoardInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Kanban_BoardInputs = {};
