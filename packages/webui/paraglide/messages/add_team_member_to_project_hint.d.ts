/**
* | output |
* | --- |
* | "Team members already have access to all projects with their default team role. Set a custom role for this specific project here." |
*
* @param {Add_Team_Member_To_Project_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_team_member_to_project_hint: ((inputs?: Add_Team_Member_To_Project_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Team_Member_To_Project_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Team_Member_To_Project_HintInputs = {};
