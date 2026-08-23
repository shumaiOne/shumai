/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Related_AssetsInputs */

const en_no_related_assets = /** @type {(inputs: No_Related_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No related assets linked`)
};

const zh_no_related_assets = /** @type {(inputs: No_Related_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无关联资产`)
};

/**
* | output |
* | --- |
* | "No related assets linked" |
*
* @param {No_Related_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_related_assets = /** @type {((inputs?: No_Related_AssetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Related_AssetsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_related_assets(inputs)
	return zh_no_related_assets(inputs)
});