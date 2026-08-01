/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Audit_Logs_DescriptionInputs */

const en_audit_logs_description = /** @type {(inputs: Audit_Logs_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`View and monitor all audit logs of team actions.`)
};

const zh_audit_logs_description = /** @type {(inputs: Audit_Logs_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`查看并监控团队操作的所有审计日志。`)
};

/**
* | output |
* | --- |
* | "View and monitor all audit logs of team actions." |
*
* @param {Audit_Logs_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const audit_logs_description = /** @type {((inputs?: Audit_Logs_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Audit_Logs_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_audit_logs_description(inputs)
	return zh_audit_logs_description(inputs)
});