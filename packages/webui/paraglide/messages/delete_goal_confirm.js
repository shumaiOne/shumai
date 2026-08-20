/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ title: NonNullable<unknown> }} Delete_Goal_ConfirmInputs */

const en_delete_goal_confirm = /** @type {(inputs: Delete_Goal_ConfirmInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Are you sure you want to delete goal "${i?.title}"? Associated tasks will remain but will no longer be linked to this goal.`)
};

const zh_delete_goal_confirm = /** @type {(inputs: Delete_Goal_ConfirmInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`确定要删除目标"${i?.title}"吗？关联的任务仍将保留，但不再关联此目标。`)
};

/**
* | output |
* | --- |
* | "Are you sure you want to delete goal \"{title}\"? Associated tasks will remain but will no longer be linked to this goal." |
*
* @param {Delete_Goal_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_goal_confirm = /** @type {((inputs: Delete_Goal_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Goal_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_goal_confirm(inputs)
	return zh_delete_goal_confirm(inputs)
});