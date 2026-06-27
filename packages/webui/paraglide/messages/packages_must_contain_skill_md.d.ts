/**
* | output |
* | --- |
* | "Packages must contain a SKILL.md" |
*
* @param {Packages_Must_Contain_Skill_MdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const packages_must_contain_skill_md: ((inputs?: Packages_Must_Contain_Skill_MdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Packages_Must_Contain_Skill_MdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Packages_Must_Contain_Skill_MdInputs = {};
