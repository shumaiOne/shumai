/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ time: NonNullable<unknown> }} Run_Started_AtInputs */

const en_run_started_at = /** @type {(inputs: Run_Started_AtInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Started ${i?.time}`)
};

const zh_run_started_at = /** @type {(inputs: Run_Started_AtInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`开始于 ${i?.time}`)
};

/**
* | output |
* | --- |
* | "Started {time}" |
*
* @param {Run_Started_AtInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const run_started_at = /** @type {((inputs: Run_Started_AtInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Run_Started_AtInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_run_started_at(inputs)
	return zh_run_started_at(inputs)
});