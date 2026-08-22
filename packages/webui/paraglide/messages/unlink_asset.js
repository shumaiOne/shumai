/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unlink_AssetInputs */

const en_unlink_asset = /** @type {(inputs: Unlink_AssetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unlink Asset`)
};

const zh_unlink_asset = /** @type {(inputs: Unlink_AssetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`取消关联资产`)
};

/**
* | output |
* | --- |
* | "Unlink Asset" |
*
* @param {Unlink_AssetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unlink_asset = /** @type {((inputs?: Unlink_AssetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unlink_AssetInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unlink_asset(inputs)
	return zh_unlink_asset(inputs)
});