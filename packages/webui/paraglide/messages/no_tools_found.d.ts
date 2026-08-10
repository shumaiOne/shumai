/**
* | output |
* | --- |
* | "No tools found matching your search." |
*
* @param {No_Tools_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_tools_found: ((inputs?: No_Tools_FoundInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Tools_FoundInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Tools_FoundInputs = {};
