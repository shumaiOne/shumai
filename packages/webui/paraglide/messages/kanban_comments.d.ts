/**
* | output |
* | --- |
* | "Kanban Comments" |
*
* @param {Kanban_CommentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_comments: ((inputs?: Kanban_CommentsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Kanban_CommentsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Kanban_CommentsInputs = {};
