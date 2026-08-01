/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Audit_LogsInputs */

const en_audit_logs = /** @type {(inputs: Audit_LogsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Audit Logs`)
};

const zh_audit_logs = /** @type {(inputs: Audit_LogsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`审计日志`)
};

/**
* | output |
* | --- |
* | "Audit Logs" |
*
* @param {Audit_LogsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const audit_logs = /** @type {((inputs?: Audit_LogsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Audit_LogsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_audit_logs(inputs)
	return zh_audit_logs(inputs)
});