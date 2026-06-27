/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_UpdatedInputs */

const en_sort_updated = /** @type {(inputs: Sort_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Updated`)
};

const zh_sort_updated = /** @type {(inputs: Sort_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新时间`)
};

/**
* | output |
* | --- |
* | "Updated" |
*
* @param {Sort_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sort_updated = /** @type {((inputs?: Sort_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sort_updated(inputs)
	return zh_sort_updated(inputs)
});