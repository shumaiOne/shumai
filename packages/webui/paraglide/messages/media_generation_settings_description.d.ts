/**
* | output |
* | --- |
* | "Configure providers and enabled models for built-in image and video generation tools." |
*
* @param {Media_Generation_Settings_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_generation_settings_description: ((inputs?: Media_Generation_Settings_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Media_Generation_Settings_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Media_Generation_Settings_DescriptionInputs = {};
