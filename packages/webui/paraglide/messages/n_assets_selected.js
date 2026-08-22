/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Assets_SelectedInputs */

const en_n_assets_selected = /** @type {(inputs: N_Assets_SelectedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} assets selected`)
};

const zh_n_assets_selected = /** @type {(inputs: N_Assets_SelectedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`已选择 ${i?.count} 个资产`)
};

/**
* | output |
* | --- |
* | "{count} assets selected" |
*
* @param {N_Assets_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_assets_selected = /** @type {((inputs: N_Assets_SelectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Assets_SelectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_assets_selected(inputs)
	return zh_n_assets_selected(inputs)
});