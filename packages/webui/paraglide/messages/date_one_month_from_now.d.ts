/**
* | output |
* | --- |
* | "One month from now" |
*
* @param {Date_One_Month_From_NowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_one_month_from_now: ((inputs?: Date_One_Month_From_NowInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Date_One_Month_From_NowInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Date_One_Month_From_NowInputs = {};
