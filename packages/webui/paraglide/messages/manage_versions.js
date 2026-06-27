/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Manage_VersionsInputs */

const en_manage_versions = /** @type {(inputs: Manage_VersionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage versions...`)
};

const zh_manage_versions = /** @type {(inputs: Manage_VersionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理版本...`)
};

/**
* | output |
* | --- |
* | "Manage versions..." |
*
* @param {Manage_VersionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_versions = /** @type {((inputs?: Manage_VersionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Manage_VersionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_manage_versions(inputs)
	return zh_manage_versions(inputs)
});