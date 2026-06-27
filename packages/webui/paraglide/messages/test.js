/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} TestInputs */

const en_test = /** @type {(inputs: TestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Test`)
};

const zh_test = /** @type {(inputs: TestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`测试`)
};

/**
* | output |
* | --- |
* | "Test" |
*
* @param {TestInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const test = /** @type {((inputs?: TestInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<TestInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test(inputs)
	return zh_test(inputs)
});