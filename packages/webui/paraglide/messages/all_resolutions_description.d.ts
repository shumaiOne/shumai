/**
* | output |
* | --- |
* | "Generates all supported resolutions up to the source quality." |
*
* @param {All_Resolutions_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_resolutions_description: ((inputs?: All_Resolutions_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<All_Resolutions_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type All_Resolutions_DescriptionInputs = {};
