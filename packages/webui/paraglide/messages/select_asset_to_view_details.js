/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Asset_To_View_DetailsInputs */

const en_select_asset_to_view_details = /** @type {(inputs: Select_Asset_To_View_DetailsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select an asset to view details`)
};

const zh_select_asset_to_view_details = /** @type {(inputs: Select_Asset_To_View_DetailsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择资产查看详情`)
};

/**
* | output |
* | --- |
* | "Select an asset to view details" |
*
* @param {Select_Asset_To_View_DetailsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_asset_to_view_details = /** @type {((inputs?: Select_Asset_To_View_DetailsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Asset_To_View_DetailsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_asset_to_view_details(inputs)
	return zh_select_asset_to_view_details(inputs)
});