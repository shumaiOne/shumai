/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ time: NonNullable<unknown>, author: NonNullable<unknown> }} Created_By_AtInputs */

const en_created_by_at = /** @type {(inputs: Created_By_AtInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.time} by ${i?.author}`)
};

const zh_created_by_at = /** @type {(inputs: Created_By_AtInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.time} 由 ${i?.author} 创建`)
};

/**
* | output |
* | --- |
* | "{time} by {author}" |
*
* @param {Created_By_AtInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const created_by_at = /** @type {((inputs: Created_By_AtInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Created_By_AtInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_created_by_at(inputs)
	return zh_created_by_at(inputs)
});