/**
* | output |
* | --- |
* | "Timestamp" |
*
* @param {TimestampInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const timestamp: ((inputs?: TimestampInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<TimestampInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type TimestampInputs = {};
