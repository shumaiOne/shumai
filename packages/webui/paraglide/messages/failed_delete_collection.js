/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Delete_CollectionInputs */

const en_failed_delete_collection = /** @type {(inputs: Failed_Delete_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to delete collection`)
};

const zh_failed_delete_collection = /** @type {(inputs: Failed_Delete_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除媒体合集失败`)
};

/**
* | output |
* | --- |
* | "Failed to delete collection" |
*
* @param {Failed_Delete_CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_collection = /** @type {((inputs?: Failed_Delete_CollectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Delete_CollectionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_delete_collection(inputs)
	return zh_failed_delete_collection(inputs)
});