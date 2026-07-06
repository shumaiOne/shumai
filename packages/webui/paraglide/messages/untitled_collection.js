/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Untitled_CollectionInputs */

const en_untitled_collection = /** @type {(inputs: Untitled_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Untitled Collection`)
};

const zh_untitled_collection = /** @type {(inputs: Untitled_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未命名媒体合集`)
};

/**
* | output |
* | --- |
* | "Untitled Collection" |
*
* @param {Untitled_CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const untitled_collection = /** @type {((inputs?: Untitled_CollectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Untitled_CollectionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_untitled_collection(inputs)
	return zh_untitled_collection(inputs)
});