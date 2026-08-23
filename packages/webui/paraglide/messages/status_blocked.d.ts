/**
* | output |
* | --- |
* | "Blocked" |
*
* @param {Status_BlockedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_blocked: ((inputs?: Status_BlockedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Status_BlockedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Status_BlockedInputs = {};
