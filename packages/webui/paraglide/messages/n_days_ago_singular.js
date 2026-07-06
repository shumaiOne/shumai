/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Days_Ago_SingularInputs */

const en_n_days_ago_singular = /** @type {(inputs: N_Days_Ago_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} day ago`)
};

const zh_n_days_ago_singular = /** @type {(inputs: N_Days_Ago_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 天前`)
};

/**
* | output |
* | --- |
* | "{count} day ago" |
*
* @param {N_Days_Ago_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_days_ago_singular = /** @type {((inputs: N_Days_Ago_SingularInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Days_Ago_SingularInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_days_ago_singular(inputs)
	return zh_n_days_ago_singular(inputs)
});