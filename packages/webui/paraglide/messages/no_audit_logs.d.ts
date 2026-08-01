/**
* | output |
* | --- |
* | "No audit logs found" |
*
* @param {No_Audit_LogsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_audit_logs: ((inputs?: No_Audit_LogsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Audit_LogsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Audit_LogsInputs = {};
