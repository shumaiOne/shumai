/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Assets_PluralInputs */

const en_n_assets_plural = /** @type {(inputs: N_Assets_PluralInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} Assets`)
};

const zh_n_assets_plural = /** @type {(inputs: N_Assets_PluralInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个资源`)
};

/**
* | output |
* | --- |
* | "{count} Assets" |
*
* @param {N_Assets_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_assets_plural = /** @type {((inputs: N_Assets_PluralInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Assets_PluralInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_assets_plural(inputs)
	return zh_n_assets_plural(inputs)
});