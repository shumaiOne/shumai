/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Api_Tokens_DescriptionInputs */

const en_api_tokens_description = /** @type {(inputs: Api_Tokens_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Generate and manage API tokens. These tokens allow you or your agents to run terminal commands via shumai-cli.`)
};

const zh_api_tokens_description = /** @type {(inputs: Api_Tokens_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`生成和管理 API 令牌。这些令牌允许您或您的智能体通过 shumai-cli 运行终端命令。`)
};

/**
* | output |
* | --- |
* | "Generate and manage API tokens. These tokens allow you or your agents to run terminal commands via shumai-cli." |
*
* @param {Api_Tokens_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_tokens_description = /** @type {((inputs?: Api_Tokens_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_Tokens_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_tokens_description(inputs)
	return zh_api_tokens_description(inputs)
});