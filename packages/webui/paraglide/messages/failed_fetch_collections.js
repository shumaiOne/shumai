/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Fetch_CollectionsInputs */

const en_failed_fetch_collections = /** @type {(inputs: Failed_Fetch_CollectionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to fetch collections`)
};

const zh_failed_fetch_collections = /** @type {(inputs: Failed_Fetch_CollectionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`获取收藏集失败`)
};

/**
* | output |
* | --- |
* | "Failed to fetch collections" |
*
* @param {Failed_Fetch_CollectionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_collections = /** @type {((inputs?: Failed_Fetch_CollectionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Fetch_CollectionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_fetch_collections(inputs)
	return zh_failed_fetch_collections(inputs)
});