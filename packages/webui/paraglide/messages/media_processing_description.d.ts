/**
* | output |
* | --- |
* | "Manage your team's media transcoding configurations." |
*
* @param {Media_Processing_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_processing_description: ((inputs?: Media_Processing_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Media_Processing_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Media_Processing_DescriptionInputs = {};
