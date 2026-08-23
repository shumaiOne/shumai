/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Related_AssetsInputs */

const en_related_assets = /** @type {(inputs: Related_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Related Assets`)
};

const zh_related_assets = /** @type {(inputs: Related_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`关联资产`)
};

/**
* | output |
* | --- |
* | "Related Assets" |
*
* @param {Related_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const related_assets = /** @type {((inputs?: Related_AssetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Related_AssetsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_related_assets(inputs)
	return zh_related_assets(inputs)
});