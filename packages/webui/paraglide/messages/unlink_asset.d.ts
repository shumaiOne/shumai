/**
* | output |
* | --- |
* | "Unlink Asset" |
*
* @param {Unlink_AssetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unlink_asset: ((inputs?: Unlink_AssetInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Unlink_AssetInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Unlink_AssetInputs = {};
