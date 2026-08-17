/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Bash_HintInputs */

const en_quota_bash_hint = /** @type {(inputs: Quota_Bash_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Supports wildcards (*). Examples: git *, npm test, curl *, python script.py (use * for all commands)`)
};

const zh_quota_bash_hint = /** @type {(inputs: Quota_Bash_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`支持通配符 (*)。示例：git *、npm test、curl *、python script.py（使用 * 匹配所有命令）`)
};

/**
* | output |
* | --- |
* | "Supports wildcards (*). Examples: git *, npm test, curl *, python script.py (use * for all commands)" |
*
* @param {Quota_Bash_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_bash_hint = /** @type {((inputs?: Quota_Bash_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Bash_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_bash_hint(inputs)
	return zh_quota_bash_hint(inputs)
});