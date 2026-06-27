/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} VersionsInputs */

const en_versions = /** @type {(inputs: VersionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Versions`)
};

const zh_versions = /** @type {(inputs: VersionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`版本`)
};

/**
* | output |
* | --- |
* | "Versions" |
*
* @param {VersionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const versions = /** @type {((inputs?: VersionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<VersionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_versions(inputs)
	return zh_versions(inputs)
});