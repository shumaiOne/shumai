/**
* | output |
* | --- |
* | "Project Preferences" |
*
* @param {Project_PreferencesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_preferences: ((inputs?: Project_PreferencesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Project_PreferencesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Project_PreferencesInputs = {};
