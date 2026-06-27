/**
* | output |
* | --- |
* | "No pending domains requiring approval" |
*
* @param {No_Pending_DomainsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_pending_domains: ((inputs?: No_Pending_DomainsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Pending_DomainsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Pending_DomainsInputs = {};
