/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Asset_UnlinkedInputs */

const en_asset_unlinked = /** @type {(inputs: Asset_UnlinkedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Asset unlinked from task`)
};

const zh_asset_unlinked = /** @type {(inputs: Asset_UnlinkedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`资产已取消关联`)
};

/**
* | output |
* | --- |
* | "Asset unlinked from task" |
*
* @param {Asset_UnlinkedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const asset_unlinked = /** @type {((inputs?: Asset_UnlinkedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Asset_UnlinkedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_asset_unlinked(inputs)
	return zh_asset_unlinked(inputs)
});