/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Collection_CreatedInputs */

const en_collection_created = /** @type {(inputs: Collection_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Collection created`)
};

const zh_collection_created = /** @type {(inputs: Collection_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`媒体合集已创建`)
};

/**
* | output |
* | --- |
* | "Collection created" |
*
* @param {Collection_CreatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const collection_created = /** @type {((inputs?: Collection_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Collection_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_collection_created(inputs)
	return zh_collection_created(inputs)
});