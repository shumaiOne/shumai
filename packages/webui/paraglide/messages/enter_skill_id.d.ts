/**
* | output |
* | --- |
* | "Enter Skill ID" |
*
* @param {Enter_Skill_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_skill_id: ((inputs?: Enter_Skill_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enter_Skill_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enter_Skill_IdInputs = {};
