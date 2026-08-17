/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Tool_HintInputs */

const en_quota_tool_hint = /** @type {(inputs: Quota_Tool_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select a specific agent tool to configure its quota limit`)
};

const zh_quota_tool_hint = /** @type {(inputs: Quota_Tool_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择特定的智能体工具以配置其配额限制`)
};

/**
* | output |
* | --- |
* | "Select a specific agent tool to configure its quota limit" |
*
* @param {Quota_Tool_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_tool_hint = /** @type {((inputs?: Quota_Tool_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Tool_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_tool_hint(inputs)
	return zh_quota_tool_hint(inputs)
});