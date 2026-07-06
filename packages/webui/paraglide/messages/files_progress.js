/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ uploaded: NonNullable<unknown>, total: NonNullable<unknown> }} Files_ProgressInputs */

const en_files_progress = /** @type {(inputs: Files_ProgressInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.uploaded} / ${i?.total} files`)
};

const zh_files_progress = /** @type {(inputs: Files_ProgressInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.uploaded} / ${i?.total} 个文件`)
};

/**
* | output |
* | --- |
* | "{uploaded} / {total} files" |
*
* @param {Files_ProgressInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const files_progress = /** @type {((inputs: Files_ProgressInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Files_ProgressInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_files_progress(inputs)
	return zh_files_progress(inputs)
});