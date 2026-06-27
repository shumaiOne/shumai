/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Collection_NameInputs */

const en_collection_name = /** @type {(inputs: Collection_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Collection Name`)
};

const zh_collection_name = /** @type {(inputs: Collection_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`收藏集名称`)
};

/**
* | output |
* | --- |
* | "Collection Name" |
*
* @param {Collection_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const collection_name = /** @type {((inputs?: Collection_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Collection_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_collection_name(inputs)
	return zh_collection_name(inputs)
});