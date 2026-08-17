/**
* | output |
* | --- |
* | "e.g. * or *.openai.com" |
*
* @param {Network_Domain_Pattern_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_domain_pattern_placeholder: ((inputs?: Network_Domain_Pattern_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Network_Domain_Pattern_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Network_Domain_Pattern_PlaceholderInputs = {};
