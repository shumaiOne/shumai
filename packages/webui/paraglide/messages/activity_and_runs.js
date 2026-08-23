/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Activity_And_RunsInputs */

const en_activity_and_runs = /** @type {(inputs: Activity_And_RunsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Activity & Runs`)
};

const zh_activity_and_runs = /** @type {(inputs: Activity_And_RunsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`活动与运行`)
};

/**
* | output |
* | --- |
* | "Activity & Runs" |
*
* @param {Activity_And_RunsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const activity_and_runs = /** @type {((inputs?: Activity_And_RunsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Activity_And_RunsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_activity_and_runs(inputs)
	return zh_activity_and_runs(inputs)
});