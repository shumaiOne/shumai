/**
* | output |
* | --- |
* | "No sessions found." |
*
* @param {No_Sessions_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_sessions_found: ((inputs?: No_Sessions_FoundInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Sessions_FoundInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Sessions_FoundInputs = {};
