/**
* | output |
* | --- |
* | "Generates a single optimal resolution matching the source quality." |
*
* @param {Best_Match_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const best_match_description: ((inputs?: Best_Match_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Best_Match_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Best_Match_DescriptionInputs = {};
