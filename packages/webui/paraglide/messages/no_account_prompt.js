/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Account_PromptInputs */

const en_no_account_prompt = /** @type {(inputs: No_Account_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Don't have an account? `)
};

const zh_no_account_prompt = /** @type {(inputs: No_Account_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`还没有账户？`)
};

/**
* | output |
* | --- |
* | "Don't have an account?" |
*
* @param {No_Account_PromptInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_account_prompt = /** @type {((inputs?: No_Account_PromptInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Account_PromptInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_account_prompt(inputs)
	return zh_no_account_prompt(inputs)
});