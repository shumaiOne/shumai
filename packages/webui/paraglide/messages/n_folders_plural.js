/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Folders_PluralInputs */

const en_n_folders_plural = /** @type {(inputs: N_Folders_PluralInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} Folders`)
};

const zh_n_folders_plural = /** @type {(inputs: N_Folders_PluralInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个文件夹`)
};

/**
* | output |
* | --- |
* | "{count} Folders" |
*
* @param {N_Folders_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_folders_plural = /** @type {((inputs: N_Folders_PluralInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Folders_PluralInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_folders_plural(inputs)
	return zh_n_folders_plural(inputs)
});