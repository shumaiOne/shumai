/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} BlockingInputs */

const en_blocking = /** @type {(inputs: BlockingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Blocking (Dependents)`)
};

const zh_blocking = /** @type {(inputs: BlockingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`后置依赖（阻止中）`)
};

/**
* | output |
* | --- |
* | "Blocking (Dependents)" |
*
* @param {BlockingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const blocking = /** @type {((inputs?: BlockingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<BlockingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_blocking(inputs)
	return zh_blocking(inputs)
});