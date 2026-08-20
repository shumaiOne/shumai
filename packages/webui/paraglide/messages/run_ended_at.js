/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ time: NonNullable<unknown> }} Run_Ended_AtInputs */

const en_run_ended_at = /** @type {(inputs: Run_Ended_AtInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Ended ${i?.time}`)
};

const zh_run_ended_at = /** @type {(inputs: Run_Ended_AtInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`结束于 ${i?.time}`)
};

/**
* | output |
* | --- |
* | "Ended {time}" |
*
* @param {Run_Ended_AtInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const run_ended_at = /** @type {((inputs: Run_Ended_AtInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Run_Ended_AtInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_run_ended_at(inputs)
	return zh_run_ended_at(inputs)
});