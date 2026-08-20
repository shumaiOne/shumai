/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Run_SummaryInputs */

const en_run_summary = /** @type {(inputs: Run_SummaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Summary`)
};

const zh_run_summary = /** @type {(inputs: Run_SummaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`总结`)
};

/**
* | output |
* | --- |
* | "Summary" |
*
* @param {Run_SummaryInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const run_summary = /** @type {((inputs?: Run_SummaryInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Run_SummaryInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_run_summary(inputs)
	return zh_run_summary(inputs)
});