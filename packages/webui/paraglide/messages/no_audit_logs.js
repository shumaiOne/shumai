/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Audit_LogsInputs */

const en_no_audit_logs = /** @type {(inputs: No_Audit_LogsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No audit logs found`)
};

const zh_no_audit_logs = /** @type {(inputs: No_Audit_LogsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到审计日志`)
};

/**
* | output |
* | --- |
* | "No audit logs found" |
*
* @param {No_Audit_LogsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_audit_logs = /** @type {((inputs?: No_Audit_LogsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Audit_LogsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_audit_logs(inputs)
	return zh_no_audit_logs(inputs)
});