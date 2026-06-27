/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Folders_SingularInputs */

const en_n_folders_singular = /** @type {(inputs: N_Folders_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} Folder`)
};

const zh_n_folders_singular = /** @type {(inputs: N_Folders_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个文件夹`)
};

/**
* | output |
* | --- |
* | "{count} Folder" |
*
* @param {N_Folders_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_folders_singular = /** @type {((inputs: N_Folders_SingularInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Folders_SingularInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_folders_singular(inputs)
	return zh_n_folders_singular(inputs)
});