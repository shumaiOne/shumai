/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Filesystem_Restriction_DescriptionInputs */

const en_filesystem_restriction_description = /** @type {(inputs: Filesystem_Restriction_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sandboxed shell commands can read workspace files except sensitive environment, certificate, and key files. They can write to the project's .pi folder and the system temporary directory, plus a few runtime-managed system paths. These filesystem rules are currently hardcoded for security.`)
};

const zh_filesystem_restriction_description = /** @type {(inputs: Filesystem_Restriction_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`沙箱 Shell 命令可以读取工作区文件，但环境变量、证书和密钥等敏感文件除外；可以写入项目的 .pi 文件夹和系统临时目录，以及少量由运行时管理的系统路径。这些文件系统规则目前出于安全考虑已硬编码。`)
};

/**
* | output |
* | --- |
* | "Sandboxed shell commands can read workspace files except sensitive environment, certificate, and key files. They can write to the project's .pi folder and th..." |
*
* @param {Filesystem_Restriction_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filesystem_restriction_description = /** @type {((inputs?: Filesystem_Restriction_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filesystem_Restriction_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_filesystem_restriction_description(inputs)
	return zh_filesystem_restriction_description(inputs)
});