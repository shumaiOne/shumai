/**
* | output |
* | --- |
* | "Invalid or missing reset token." |
*
* @param {Invalid_Reset_TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invalid_reset_token: ((inputs?: Invalid_Reset_TokenInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Invalid_Reset_TokenInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Invalid_Reset_TokenInputs = {};
