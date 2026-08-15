/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Versions_FoundInputs */

const en_no_versions_found = /** @type {(inputs: No_Versions_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No versions found`)
};

const zh_no_versions_found = /** @type {(inputs: No_Versions_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无版本`)
};

/**
* | output |
* | --- |
* | "No versions found" |
*
* @param {No_Versions_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_versions_found = /** @type {((inputs?: No_Versions_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Versions_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_versions_found(inputs)
	return zh_no_versions_found(inputs)
});