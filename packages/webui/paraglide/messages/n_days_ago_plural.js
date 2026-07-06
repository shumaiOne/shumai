/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Days_Ago_PluralInputs */

const en_n_days_ago_plural = /** @type {(inputs: N_Days_Ago_PluralInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} days ago`)
};

const zh_n_days_ago_plural = /** @type {(inputs: N_Days_Ago_PluralInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 天前`)
};

/**
* | output |
* | --- |
* | "{count} days ago" |
*
* @param {N_Days_Ago_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_days_ago_plural = /** @type {((inputs: N_Days_Ago_PluralInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Days_Ago_PluralInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_days_ago_plural(inputs)
	return zh_n_days_ago_plural(inputs)
});