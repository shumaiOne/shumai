/**
* | output |
* | --- |
* | "Describe the desired outcome and success criteria..." |
*
* @param {Goal_Description_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_description_placeholder: ((inputs?: Goal_Description_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Goal_Description_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Goal_Description_PlaceholderInputs = {};
