/**
* | output |
* | --- |
* | "Saving..." |
*
* @param {Saving_EllipsisInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const saving_ellipsis: ((inputs?: Saving_EllipsisInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Saving_EllipsisInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Saving_EllipsisInputs = {};
