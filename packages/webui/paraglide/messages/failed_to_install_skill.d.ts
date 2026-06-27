/**
* | output |
* | --- |
* | "Failed to install skill" |
*
* @param {Failed_To_Install_SkillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_install_skill: ((inputs?: Failed_To_Install_SkillInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Install_SkillInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Install_SkillInputs = {};
