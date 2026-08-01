/**
* | output |
* | --- |
* | "Audit Logs" |
*
* @param {Audit_LogsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const audit_logs: ((inputs?: Audit_LogsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Audit_LogsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Audit_LogsInputs = {};
