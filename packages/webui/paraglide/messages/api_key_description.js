/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Api_Key_DescriptionInputs */

const en_api_key_description = /** @type {(inputs: Api_Key_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You can provide a literal value (e.g. sk-...) or an Environment variable name (e.g. MY_API_KEY).`)
};

const zh_api_key_description = /** @type {(inputs: Api_Key_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`您可以提供一个字面值（例如 sk-...）或环境变量名称（例如 MY_API_KEY）。`)
};

/**
* | output |
* | --- |
* | "You can provide a literal value (e.g. sk-...) or an Environment variable name (e.g. MY_API_KEY)." |
*
* @param {Api_Key_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_description = /** @type {((inputs?: Api_Key_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_Key_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_key_description(inputs)
	return zh_api_key_description(inputs)
});