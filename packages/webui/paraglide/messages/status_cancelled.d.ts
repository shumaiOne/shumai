/**
* | output |
* | --- |
* | "Cancelled" |
*
* @param {Status_CancelledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_cancelled: ((inputs?: Status_CancelledInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Status_CancelledInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Status_CancelledInputs = {};
