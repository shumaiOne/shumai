/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CollectionsInputs */

const en_collections = /** @type {(inputs: CollectionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Collections`)
};

const zh_collections = /** @type {(inputs: CollectionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`收藏集`)
};

/**
* | output |
* | --- |
* | "Collections" |
*
* @param {CollectionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const collections = /** @type {((inputs?: CollectionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CollectionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_collections(inputs)
	return zh_collections(inputs)
});