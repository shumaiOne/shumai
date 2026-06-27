/**
* | output |
* | --- |
* | "Select an asset to view details" |
*
* @param {Select_Asset_To_View_DetailsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_asset_to_view_details: ((inputs?: Select_Asset_To_View_DetailsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Asset_To_View_DetailsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Asset_To_View_DetailsInputs = {};
