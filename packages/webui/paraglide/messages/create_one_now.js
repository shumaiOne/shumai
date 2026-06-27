/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_One_NowInputs */

const en_create_one_now = /** @type {(inputs: Create_One_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create one now`)
};

const zh_create_one_now = /** @type {(inputs: Create_One_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`立即创建`)
};

/**
* | output |
* | --- |
* | "Create one now" |
*
* @param {Create_One_NowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_one_now = /** @type {((inputs?: Create_One_NowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_One_NowInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_one_now(inputs)
	return zh_create_one_now(inputs)
});