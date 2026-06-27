/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ListInputs */

const en_list = /** @type {(inputs: ListInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`List`)
};

const zh_list = /** @type {(inputs: ListInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`列表`)
};

/**
* | output |
* | --- |
* | "List" |
*
* @param {ListInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const list = /** @type {((inputs?: ListInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ListInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_list(inputs)
	return zh_list(inputs)
});