/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loading_CollectionInputs */

const en_loading_collection = /** @type {(inputs: Loading_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading collection...`)
};

const zh_loading_collection = /** @type {(inputs: Loading_CollectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在加载媒体合集...`)
};

/**
* | output |
* | --- |
* | "Loading collection..." |
*
* @param {Loading_CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const loading_collection = /** @type {((inputs?: Loading_CollectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loading_CollectionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_loading_collection(inputs)
	return zh_loading_collection(inputs)
});