/**
* | output |
* | --- |
* | "Enable Timestamp" |
*
* @param {Enable_TimestampInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enable_timestamp: ((inputs?: Enable_TimestampInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enable_TimestampInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enable_TimestampInputs = {};
