/**
* | output |
* | --- |
* | "Today {time}" |
*
* @param {Today_With_TimeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const today_with_time: ((inputs: Today_With_TimeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Today_With_TimeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Today_With_TimeInputs = {
    time: NonNullable<unknown>;
};
