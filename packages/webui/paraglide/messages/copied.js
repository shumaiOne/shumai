/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CopiedInputs */

const en_copied = /** @type {(inputs: CopiedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copied!`)
};

const zh_copied = /** @type {(inputs: CopiedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已复制！`)
};

/**
* | output |
* | --- |
* | "Copied!" |
*
* @param {CopiedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copied = /** @type {((inputs?: CopiedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CopiedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_copied(inputs)
	return zh_copied(inputs)
});