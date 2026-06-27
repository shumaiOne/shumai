/**
* | output |
* | --- |
* | "These domains were blocked during agent execution. You can approve them to allow future network requests, or delete them from this list." |
*
* @param {Pending_Domains_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const pending_domains_description: ((inputs?: Pending_Domains_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Pending_Domains_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Pending_Domains_DescriptionInputs = {};
