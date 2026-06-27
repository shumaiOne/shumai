/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_AccessInputs */

const en_demo_access = /** @type {(inputs: Demo_AccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Demo Access:`)
};

const zh_demo_access = /** @type {(inputs: Demo_AccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`演示访问：`)
};

/**
* | output |
* | --- |
* | "Demo Access:" |
*
* @param {Demo_AccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const demo_access = /** @type {((inputs?: Demo_AccessInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_AccessInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_access(inputs)
	return zh_demo_access(inputs)
});