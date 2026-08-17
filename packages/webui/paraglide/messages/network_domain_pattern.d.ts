/**
* | output |
* | --- |
* | "Domain Wildcard" |
*
* @param {Network_Domain_PatternInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_domain_pattern: ((inputs?: Network_Domain_PatternInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Network_Domain_PatternInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Network_Domain_PatternInputs = {};
