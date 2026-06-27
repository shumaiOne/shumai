/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unknown_AssetInputs */

const en_unknown_asset = /** @type {(inputs: Unknown_AssetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`unknown asset`)
};

const zh_unknown_asset = /** @type {(inputs: Unknown_AssetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未知资源`)
};

/**
* | output |
* | --- |
* | "unknown asset" |
*
* @param {Unknown_AssetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unknown_asset = /** @type {((inputs?: Unknown_AssetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unknown_AssetInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unknown_asset(inputs)
	return zh_unknown_asset(inputs)
});