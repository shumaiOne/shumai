/**
* | output |
* | --- |
* | "Add Members from Other Projects" |
*
* @param {Add_Members_From_Other_ProjectsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_members_from_other_projects: ((inputs?: Add_Members_From_Other_ProjectsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Members_From_Other_ProjectsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Members_From_Other_ProjectsInputs = {};
