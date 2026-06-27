/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} InstalledInputs */

const en_installed = /** @type {(inputs: InstalledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Installed`)
};

const zh_installed = /** @type {(inputs: InstalledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已安装`)
};

/**
* | output |
* | --- |
* | "Installed" |
*
* @param {InstalledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const installed = /** @type {((inputs?: InstalledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<InstalledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_installed(inputs)
	return zh_installed(inputs)
});