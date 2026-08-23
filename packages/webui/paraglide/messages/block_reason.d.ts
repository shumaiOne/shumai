/**
* | output |
* | --- |
* | "Block Reason" |
*
* @param {Block_ReasonInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const block_reason: ((inputs?: Block_ReasonInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Block_ReasonInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Block_ReasonInputs = {};
