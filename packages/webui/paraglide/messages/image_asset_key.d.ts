/**
* | output |
* | --- |
* | "Image Asset" |
*
* @param {Image_Asset_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_asset_key: ((inputs?: Image_Asset_KeyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Image_Asset_KeyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Image_Asset_KeyInputs = {};
