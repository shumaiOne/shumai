/**
* | output |
* | --- |
* | "Context Window (tokens)" |
*
* @param {Context_Window_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const context_window_tokens: ((inputs?: Context_Window_TokensInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Context_Window_TokensInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Context_Window_TokensInputs = {};
