/**
* | output |
* | --- |
* | "Pending Domain Approvals" |
*
* @param {Pending_Domain_ApprovalsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const pending_domain_approvals: ((inputs?: Pending_Domain_ApprovalsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Pending_Domain_ApprovalsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Pending_Domain_ApprovalsInputs = {};
