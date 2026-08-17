/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Network_HintInputs */

const en_quota_network_hint = /** @type {(inputs: Quota_Network_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Supports wildcards (*). Examples: *.github.com, api.openai.com, *.internal.net (use * for all domains)`)
};

const zh_quota_network_hint = /** @type {(inputs: Quota_Network_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`支持通配符 (*)。示例：*.github.com、api.openai.com、*.internal.net（使用 * 匹配所有域名）`)
};

/**
* | output |
* | --- |
* | "Supports wildcards (*). Examples: *.github.com, api.openai.com, *.internal.net (use * for all domains)" |
*
* @param {Quota_Network_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_network_hint = /** @type {((inputs?: Quota_Network_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Network_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_network_hint(inputs)
	return zh_quota_network_hint(inputs)
});