/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agents_Md_Save_FailedInputs */

const en_agents_md_save_failed = /** @type {(inputs: Agents_Md_Save_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to save`)
};

const zh_agents_md_save_failed = /** @type {(inputs: Agents_Md_Save_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`保存失败`)
};

/**
* | output |
* | --- |
* | "Failed to save" |
*
* @param {Agents_Md_Save_FailedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents_md_save_failed = /** @type {((inputs?: Agents_Md_Save_FailedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agents_Md_Save_FailedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agents_md_save_failed(inputs)
	return zh_agents_md_save_failed(inputs)
});