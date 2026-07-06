/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Collection_RenamedInputs */

const en_collection_renamed = /** @type {(inputs: Collection_RenamedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Collection renamed`)
};

const zh_collection_renamed = /** @type {(inputs: Collection_RenamedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`媒体合集已重命名`)
};

/**
* | output |
* | --- |
* | "Collection renamed" |
*
* @param {Collection_RenamedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const collection_renamed = /** @type {((inputs?: Collection_RenamedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Collection_RenamedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_collection_renamed(inputs)
	return zh_collection_renamed(inputs)
});