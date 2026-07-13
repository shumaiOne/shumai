/**
* | output |
* | --- |
* | "Shumai Agent" |
*
* @param {Shumai_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const shumai_agent: ((inputs?: Shumai_AgentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Shumai_AgentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Shumai_AgentInputs = {};
