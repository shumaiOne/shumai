/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Rename_CollectionInputs */

const en_failed_rename_collection = /** @type {(inputs: Failed_Rename_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to rename collection`)
};

const zh_failed_rename_collection = /** @type {(inputs: Failed_Rename_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`重命名媒体合集失败`)
};

/**
* | output |
* | --- |
* | "Failed to rename collection" |
*
* @param {Failed_Rename_CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_rename_collection = /** @type {((inputs?: Failed_Rename_CollectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Rename_CollectionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_rename_collection(inputs)
	return zh_failed_rename_collection(inputs)
});