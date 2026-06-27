/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AssetsInputs */

const en_assets = /** @type {(inputs: AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Assets`)
};

const zh_assets = /** @type {(inputs: AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`资源`)
};

/**
* | output |
* | --- |
* | "Assets" |
*
* @param {AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const assets = /** @type {((inputs?: AssetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AssetsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_assets(inputs)
	return zh_assets(inputs)
});