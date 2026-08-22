/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Asset_LinkedInputs */

const en_asset_linked = /** @type {(inputs: Asset_LinkedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Asset linked to task`)
};

const zh_asset_linked = /** @type {(inputs: Asset_LinkedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`资产已关联到任务`)
};

/**
* | output |
* | --- |
* | "Asset linked to task" |
*
* @param {Asset_LinkedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const asset_linked = /** @type {((inputs?: Asset_LinkedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Asset_LinkedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_asset_linked(inputs)
	return zh_asset_linked(inputs)
});