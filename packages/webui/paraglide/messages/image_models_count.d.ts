/**
* | output |
* | --- |
* | "{count} enabled" |
*
* @param {Image_Models_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_models_count: ((inputs: Image_Models_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Image_Models_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Image_Models_CountInputs = {
    count: NonNullable<unknown>;
};
