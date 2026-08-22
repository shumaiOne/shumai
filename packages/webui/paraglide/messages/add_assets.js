/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_AssetsInputs */

const en_add_assets = /** @type {(inputs: Add_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Assets`)
};

const zh_add_assets = /** @type {(inputs: Add_AssetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加资产`)
};

/**
* | output |
* | --- |
* | "Add Assets" |
*
* @param {Add_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_assets = /** @type {((inputs?: Add_AssetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_AssetsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_assets(inputs)
	return zh_add_assets(inputs)
});