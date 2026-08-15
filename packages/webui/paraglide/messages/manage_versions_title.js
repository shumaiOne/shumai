/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Manage_Versions_TitleInputs */

const en_manage_versions_title = /** @type {(inputs: Manage_Versions_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage versions`)
};

const zh_manage_versions_title = /** @type {(inputs: Manage_Versions_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理版本`)
};

/**
* | output |
* | --- |
* | "Manage versions" |
*
* @param {Manage_Versions_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_versions_title = /** @type {((inputs?: Manage_Versions_TitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Manage_Versions_TitleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_manage_versions_title(inputs)
	return zh_manage_versions_title(inputs)
});