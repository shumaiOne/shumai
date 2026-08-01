/**
* | output |
* | --- |
* | "View and monitor all audit logs of team actions." |
*
* @param {Audit_Logs_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const audit_logs_description: ((inputs?: Audit_Logs_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Audit_Logs_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Audit_Logs_DescriptionInputs = {};
