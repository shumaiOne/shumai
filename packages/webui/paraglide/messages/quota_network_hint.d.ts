/**
* | output |
* | --- |
* | "Supports wildcards (*). Examples: *.github.com, api.openai.com, *.internal.net (use * for all domains)" |
*
* @param {Quota_Network_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_network_hint: ((inputs?: Quota_Network_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Network_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Network_HintInputs = {};
