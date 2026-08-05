/**
* | output |
* | --- |
* | "Project-scoped members who currently do not have access to this project." |
*
* @param {Add_Members_From_Other_Projects_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_members_from_other_projects_hint: ((inputs?: Add_Members_From_Other_Projects_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Members_From_Other_Projects_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Members_From_Other_Projects_HintInputs = {};
