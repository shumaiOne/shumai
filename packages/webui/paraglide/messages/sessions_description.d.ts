/**
* | output |
* | --- |
* | "View and inspect all agent sessions created within the team." |
*
* @param {Sessions_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sessions_description: ((inputs?: Sessions_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sessions_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sessions_DescriptionInputs = {};
