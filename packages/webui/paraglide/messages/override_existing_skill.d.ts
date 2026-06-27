/**
* | output |
* | --- |
* | "Do you want to override the existing skill?" |
*
* @param {Override_Existing_SkillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const override_existing_skill: ((inputs?: Override_Existing_SkillInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Override_Existing_SkillInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Override_Existing_SkillInputs = {};
