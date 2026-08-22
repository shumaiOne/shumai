/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_AssetsInputs */

const en_select_assets = /** @type {(inputs: Select_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Assets`)
};

const zh_select_assets = /** @type {(inputs: Select_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择资产`)
};

/**
* | output |
* | --- |
* | "Select Assets" |
*
* @param {Select_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_assets = /** @type {((inputs?: Select_AssetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_AssetsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_assets(inputs)
	return zh_select_assets(inputs)
});