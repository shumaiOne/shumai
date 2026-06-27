/**
* | output |
* | --- |
* | "Failed to generate token" |
*
* @param {Failed_To_Generate_TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_generate_token: ((inputs?: Failed_To_Generate_TokenInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Generate_TokenInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Generate_TokenInputs = {};
