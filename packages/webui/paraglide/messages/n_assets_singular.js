/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Assets_SingularInputs */

const en_n_assets_singular = /** @type {(inputs: N_Assets_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} Asset`)
};

const zh_n_assets_singular = /** @type {(inputs: N_Assets_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个资源`)
};

/**
* | output |
* | --- |
* | "{count} Asset" |
*
* @param {N_Assets_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_assets_singular = /** @type {((inputs: N_Assets_SingularInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Assets_SingularInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_assets_singular(inputs)
	return zh_n_assets_singular(inputs)
});