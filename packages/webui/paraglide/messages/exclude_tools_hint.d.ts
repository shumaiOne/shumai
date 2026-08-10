/**
* | output |
* | --- |
* | "Comma-separated tool names to exclude" |
*
* @param {Exclude_Tools_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const exclude_tools_hint: ((inputs?: Exclude_Tools_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Exclude_Tools_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Exclude_Tools_HintInputs = {};
