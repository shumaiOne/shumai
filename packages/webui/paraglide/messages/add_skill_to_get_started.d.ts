/**
* | output |
* | --- |
* | "Add a skill via GitHub URL or upload a ZIP file to get started." |
*
* @param {Add_Skill_To_Get_StartedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_skill_to_get_started: ((inputs?: Add_Skill_To_Get_StartedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Skill_To_Get_StartedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Skill_To_Get_StartedInputs = {};
