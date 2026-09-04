/**
* | output |
* | --- |
* | "{user} via {agent}" |
*
* @param {User_Via_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const user_via_agent: ((inputs: User_Via_AgentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<User_Via_AgentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type User_Via_AgentInputs = {
    user: NonNullable<unknown>;
    agent: NonNullable<unknown>;
};
