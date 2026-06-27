/**
* | output |
* | --- |
* | "1 Week" |
*
* @param {One_WeekInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const one_week: ((inputs?: One_WeekInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<One_WeekInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type One_WeekInputs = {};
