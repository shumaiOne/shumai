/**
* | output |
* | --- |
* | "Try adjusting spelling or removing filter rows." |
*
* @param {Try_Adjusting_SpellingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const try_adjusting_spelling: ((inputs?: Try_Adjusting_SpellingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Try_Adjusting_SpellingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Try_Adjusting_SpellingInputs = {};
