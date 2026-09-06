/**
* | output |
* | --- |
* | "All" |
*
* @param {All_ModalitiesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_modalities: ((inputs?: All_ModalitiesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<All_ModalitiesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type All_ModalitiesInputs = {};
