/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Task_Type_Manual_DescInputs */

const en_task_type_manual_desc = /** @type {(inputs: Task_Type_Manual_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Performed or managed by a team member`)
};

const zh_task_type_manual_desc = /** @type {(inputs: Task_Type_Manual_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`由团队成员手动执行或管理`)
};

/**
* | output |
* | --- |
* | "Performed or managed by a team member" |
*
* @param {Task_Type_Manual_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_manual_desc = /** @type {((inputs?: Task_Type_Manual_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Task_Type_Manual_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_task_type_manual_desc(inputs)
	return zh_task_type_manual_desc(inputs)
});