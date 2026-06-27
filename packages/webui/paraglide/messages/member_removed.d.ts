/**
* | output |
* | --- |
* | "Member removed" |
*
* @param {Member_RemovedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const member_removed: ((inputs?: Member_RemovedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Member_RemovedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Member_RemovedInputs = {};
