/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Reorder_VersionsInputs */

const en_failed_to_reorder_versions = /** @type {(inputs: Failed_To_Reorder_VersionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to reorder versions`)
};

const zh_failed_to_reorder_versions = /** @type {(inputs: Failed_To_Reorder_VersionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`版本重新排序失败`)
};

/**
* | output |
* | --- |
* | "Failed to reorder versions" |
*
* @param {Failed_To_Reorder_VersionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_reorder_versions = /** @type {((inputs?: Failed_To_Reorder_VersionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Reorder_VersionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_reorder_versions(inputs)
	return zh_failed_to_reorder_versions(inputs)
});