/**
* | output |
* | --- |
* | "One month ago" |
*
* @param {Date_One_Month_AgoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_one_month_ago: ((inputs?: Date_One_Month_AgoInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Date_One_Month_AgoInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Date_One_Month_AgoInputs = {};
