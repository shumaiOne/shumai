/**
* | output |
* | --- |
* | "Select a specific agent tool to configure its quota limit" |
*
* @param {Quota_Tool_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_tool_hint: ((inputs?: Quota_Tool_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Tool_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Tool_HintInputs = {};
