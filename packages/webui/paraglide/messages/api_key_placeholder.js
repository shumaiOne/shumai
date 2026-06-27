/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Api_Key_PlaceholderInputs */

const en_api_key_placeholder = /** @type {(inputs: Api_Key_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter API Key or Environment Variable`)
};

const zh_api_key_placeholder = /** @type {(inputs: Api_Key_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入 API 密钥或环境变量`)
};

/**
* | output |
* | --- |
* | "Enter API Key or Environment Variable" |
*
* @param {Api_Key_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_placeholder = /** @type {((inputs?: Api_Key_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_Key_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_key_placeholder(inputs)
	return zh_api_key_placeholder(inputs)
});