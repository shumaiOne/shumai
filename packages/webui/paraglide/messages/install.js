/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} InstallInputs */

const en_install = /** @type {(inputs: InstallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Install`)
};

const zh_install = /** @type {(inputs: InstallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`安装`)
};

/**
* | output |
* | --- |
* | "Install" |
*
* @param {InstallInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const install = /** @type {((inputs?: InstallInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<InstallInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_install(inputs)
	return zh_install(inputs)
});