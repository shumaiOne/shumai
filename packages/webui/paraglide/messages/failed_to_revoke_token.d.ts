/**
* | output |
* | --- |
* | "Failed to revoke token" |
*
* @param {Failed_To_Revoke_TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_revoke_token: ((inputs?: Failed_To_Revoke_TokenInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Revoke_TokenInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Revoke_TokenInputs = {};
