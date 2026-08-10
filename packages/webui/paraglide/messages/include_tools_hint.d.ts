/**
* | output |
* | --- |
* | "Comma-separated tool names to include (empty = all)" |
*
* @param {Include_Tools_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const include_tools_hint: ((inputs?: Include_Tools_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Include_Tools_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Include_Tools_HintInputs = {};
