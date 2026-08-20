/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Team_TasksInputs */

const en_team_tasks = /** @type {(inputs: Team_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Team Tasks`)
};

const zh_team_tasks = /** @type {(inputs: Team_TasksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队任务`)
};

/**
* | output |
* | --- |
* | "Team Tasks" |
*
* @param {Team_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const team_tasks = /** @type {((inputs?: Team_TasksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Team_TasksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_team_tasks(inputs)
	return zh_team_tasks(inputs)
});