/**
* | output |
* | --- |
* | "View step-by-step execution history and logs for all agent sessions across your team." |
*
* @param {Agent_Sessions_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_sessions_description: ((inputs?: Agent_Sessions_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Sessions_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Sessions_DescriptionInputs = {};
