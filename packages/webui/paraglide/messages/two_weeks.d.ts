/**
* | output |
* | --- |
* | "2 Weeks" |
*
* @param {Two_WeeksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const two_weeks: ((inputs?: Two_WeeksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Two_WeeksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Two_WeeksInputs = {};
