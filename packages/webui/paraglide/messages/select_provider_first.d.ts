/**
* | output |
* | --- |
* | "Select a provider on the left to view available models" |
*
* @param {Select_Provider_FirstInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_provider_first: ((inputs?: Select_Provider_FirstInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Provider_FirstInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Provider_FirstInputs = {};
