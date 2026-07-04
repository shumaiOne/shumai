/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Switch_VersionInputs */

const en_switch_version = /** @type {(inputs: Switch_VersionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Switch version`)
};

const zh_switch_version = /** @type {(inputs: Switch_VersionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`切换版本`)
};

/**
* | output |
* | --- |
* | "Switch version" |
*
* @param {Switch_VersionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const switch_version = /** @type {((inputs?: Switch_VersionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Switch_VersionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_switch_version(inputs)
	return zh_switch_version(inputs)
});