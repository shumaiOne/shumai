/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Items_SingularInputs */

const en_n_items_singular = /** @type {(inputs: N_Items_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} Item`)
};

const zh_n_items_singular = /** @type {(inputs: N_Items_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个项目`)
};

/**
* | output |
* | --- |
* | "{count} Item" |
*
* @param {N_Items_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_items_singular = /** @type {((inputs: N_Items_SingularInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Items_SingularInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_items_singular(inputs)
	return zh_n_items_singular(inputs)
});