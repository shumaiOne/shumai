/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loading_MoreInputs */

const en_loading_more = /** @type {(inputs: Loading_MoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading more...`)
};

const zh_loading_more = /** @type {(inputs: Loading_MoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`加载更多...`)
};

/**
* | output |
* | --- |
* | "Loading more..." |
*
* @param {Loading_MoreInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const loading_more = /** @type {((inputs?: Loading_MoreInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loading_MoreInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_loading_more(inputs)
	return zh_loading_more(inputs)
});