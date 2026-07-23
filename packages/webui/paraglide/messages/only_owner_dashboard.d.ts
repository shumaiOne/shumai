/**
* | output |
* | --- |
* | "Only team owners can access the dashboard." |
*
* @param {Only_Owner_DashboardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const only_owner_dashboard: ((inputs?: Only_Owner_DashboardInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Only_Owner_DashboardInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Only_Owner_DashboardInputs = {};
