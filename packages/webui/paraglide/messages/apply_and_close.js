/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Apply_And_CloseInputs */

const en_apply_and_close = /** @type {(inputs: Apply_And_CloseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Apply and Close`)
};

const zh_apply_and_close = /** @type {(inputs: Apply_And_CloseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`应用并关闭`)
};

/**
* | output |
* | --- |
* | "Apply and Close" |
*
* @param {Apply_And_CloseInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const apply_and_close = /** @type {((inputs?: Apply_And_CloseInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Apply_And_CloseInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_apply_and_close(inputs)
	return zh_apply_and_close(inputs)
});