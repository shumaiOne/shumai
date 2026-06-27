export type LocalizedString = import("../runtime.js").LocalizedString;
export type _DeleteInputs = {};
/**
* | output |
* | --- |
* | "Delete" |
*
* @param {_DeleteInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
declare const _delete: ((inputs?: _DeleteInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<_DeleteInputs, {
    locale?: "en" | "zh";
}, {}>;
export { _delete as "delete" };
