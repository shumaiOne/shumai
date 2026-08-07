/**
* | output |
* | --- |
* | "Image Asset ID" |
*
* @param {Image_Asset_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_asset_id: ((inputs?: Image_Asset_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Image_Asset_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Image_Asset_IdInputs = {};
