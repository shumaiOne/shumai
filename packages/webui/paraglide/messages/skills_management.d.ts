/**
* | output |
* | --- |
* | "Skills Management" |
*
* @param {Skills_ManagementInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const skills_management: ((inputs?: Skills_ManagementInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Skills_ManagementInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Skills_ManagementInputs = {};
