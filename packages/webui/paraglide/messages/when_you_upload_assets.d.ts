/**
* | output |
* | --- |
* | "When you upload assets" |
*
* @param {When_You_Upload_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const when_you_upload_assets: ((inputs?: When_You_Upload_AssetsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<When_You_Upload_AssetsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type When_You_Upload_AssetsInputs = {};
