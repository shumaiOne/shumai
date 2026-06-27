/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_New_VersionInputs */

const en_create_new_version = /** @type {(inputs: Create_New_VersionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create new version`)
};

const zh_create_new_version = /** @type {(inputs: Create_New_VersionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建新版本`)
};

/**
* | output |
* | --- |
* | "Create new version" |
*
* @param {Create_New_VersionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_new_version = /** @type {((inputs?: Create_New_VersionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_New_VersionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_new_version(inputs)
	return zh_create_new_version(inputs)
});