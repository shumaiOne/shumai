/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Save_CollectionInputs */

const en_failed_save_collection = /** @type {(inputs: Failed_Save_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to save collection`)
};

const zh_failed_save_collection = /** @type {(inputs: Failed_Save_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`保存收藏集失败`)
};

/**
* | output |
* | --- |
* | "Failed to save collection" |
*
* @param {Failed_Save_CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_save_collection = /** @type {((inputs?: Failed_Save_CollectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Save_CollectionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_save_collection(inputs)
	return zh_failed_save_collection(inputs)
});