/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CollectionInputs */

const en_collection = /** @type {(inputs: CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`collection`)
};

const zh_collection = /** @type {(inputs: CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`收藏集`)
};

/**
* | output |
* | --- |
* | "collection" |
*
* @param {CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const collection = /** @type {((inputs?: CollectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CollectionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_collection(inputs)
	return zh_collection(inputs)
});