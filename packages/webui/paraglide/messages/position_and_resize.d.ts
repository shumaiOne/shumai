/**
* | output |
* | --- |
* | "Position and resize" |
*
* @param {Position_And_ResizeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const position_and_resize: ((inputs?: Position_And_ResizeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Position_And_ResizeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Position_And_ResizeInputs = {};
