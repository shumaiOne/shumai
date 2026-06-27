/**
* | output |
* | --- |
* | "Yesterday" |
*
* @param {Date_YesterdayInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_yesterday: ((inputs?: Date_YesterdayInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Date_YesterdayInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Date_YesterdayInputs = {};
