/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Folders_SelectedInputs */

const en_n_folders_selected = /** @type {(inputs: N_Folders_SelectedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} folder(s) selected`)
};

const zh_n_folders_selected = /** @type {(inputs: N_Folders_SelectedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`已选择 ${i?.count} 个文件夹`)
};

/**
* | output |
* | --- |
* | "{count} folder(s) selected" |
*
* @param {N_Folders_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_folders_selected = /** @type {((inputs: N_Folders_SelectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Folders_SelectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_folders_selected(inputs)
	return zh_n_folders_selected(inputs)
});