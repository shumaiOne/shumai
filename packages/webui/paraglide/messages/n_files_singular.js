/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Files_SingularInputs */

const en_n_files_singular = /** @type {(inputs: N_Files_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} file`)
};

const zh_n_files_singular = /** @type {(inputs: N_Files_SingularInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个文件`)
};

/**
* | output |
* | --- |
* | "{count} file" |
*
* @param {N_Files_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_files_singular = /** @type {((inputs: N_Files_SingularInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Files_SingularInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_n_files_singular(inputs)
	return zh_n_files_singular(inputs)
});