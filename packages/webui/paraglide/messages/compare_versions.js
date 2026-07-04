/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Compare_VersionsInputs */

const en_compare_versions = /** @type {(inputs: Compare_VersionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Compare Versions`)
};

const zh_compare_versions = /** @type {(inputs: Compare_VersionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`对比版本`)
};

/**
* | output |
* | --- |
* | "Compare Versions" |
*
* @param {Compare_VersionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const compare_versions = /** @type {((inputs?: Compare_VersionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Compare_VersionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_compare_versions(inputs)
	return zh_compare_versions(inputs)
});