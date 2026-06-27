/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Generate_TokenInputs */

const en_failed_to_generate_token = /** @type {(inputs: Failed_To_Generate_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to generate token`)
};

const zh_failed_to_generate_token = /** @type {(inputs: Failed_To_Generate_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`生成令牌失败`)
};

/**
* | output |
* | --- |
* | "Failed to generate token" |
*
* @param {Failed_To_Generate_TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_generate_token = /** @type {((inputs?: Failed_To_Generate_TokenInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Generate_TokenInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_generate_token(inputs)
	return zh_failed_to_generate_token(inputs)
});