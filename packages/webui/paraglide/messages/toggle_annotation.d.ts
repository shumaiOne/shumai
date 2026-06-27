/**
* | output |
* | --- |
* | "Toggle Annotation" |
*
* @param {Toggle_AnnotationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const toggle_annotation: ((inputs?: Toggle_AnnotationInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Toggle_AnnotationInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Toggle_AnnotationInputs = {};
