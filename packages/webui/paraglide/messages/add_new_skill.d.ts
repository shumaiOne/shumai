/**
* | output |
* | --- |
* | "Add New Skill" |
*
* @param {Add_New_SkillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_new_skill: ((inputs?: Add_New_SkillInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_New_SkillInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_New_SkillInputs = {};
