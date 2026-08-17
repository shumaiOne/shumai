/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Quotas_TitleInputs */

const en_no_quotas_title = /** @type {(inputs: No_Quotas_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No resource quotas configured`)
};

const zh_no_quotas_title = /** @type {(inputs: No_Quotas_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂未配置资源配额`)
};

/**
* | output |
* | --- |
* | "No resource quotas configured" |
*
* @param {No_Quotas_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_quotas_title = /** @type {((inputs?: No_Quotas_TitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Quotas_TitleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_quotas_title(inputs)
	return zh_no_quotas_title(inputs)
});