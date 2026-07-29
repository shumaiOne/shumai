/**
* | output |
* | --- |
* | "Sessions" |
*
* @param {Agent_SessionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_sessions: ((inputs?: Agent_SessionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_SessionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_SessionsInputs = {};
