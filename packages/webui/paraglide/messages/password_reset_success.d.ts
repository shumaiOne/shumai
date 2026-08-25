/**
* | output |
* | --- |
* | "Password reset successfully!" |
*
* @param {Password_Reset_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password_reset_success: ((inputs?: Password_Reset_SuccessInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Password_Reset_SuccessInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Password_Reset_SuccessInputs = {};
