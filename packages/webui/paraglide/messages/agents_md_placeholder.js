/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agents_Md_PlaceholderInputs */

const en_agents_md_placeholder = /** @type {(inputs: Agents_Md_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Give AI agents instructions and context for this project or folder.

Shumai automatically loads this file, along with AGENTS.md files from parent folders up to the project level, whenever an agent works here.

Use it to define things like:
- What this project or folder contains
- Rules the agent should follow
- Terminology, style, or workflow
- How metadata and autofill should be generated`)
};

const zh_agents_md_placeholder = /** @type {(inputs: Agents_Md_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`为在此项目或文件夹中工作的 AI Agent 提供指引和上下文。

当 Agent 在此处工作时，Shumai 会自动加载此文件以及向上追溯至项目根目录各级父文件夹中的 AGENTS.md 文件。

您可以用它来定义：
- 此项目或文件夹包含的内容
- Agent 应当遵守的规则
- 术语、风格或工作流规范
- 元数据和自动填充的生成方式`)
};

/**
* | output |
* | --- |
* | "Give AI agents instructions and context for this project or folder. Shumai automatically loads this file, along with AGENTS.md files from parent folders up t..." |
*
* @param {Agents_Md_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents_md_placeholder = /** @type {((inputs?: Agents_Md_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agents_Md_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agents_md_placeholder(inputs)
	return zh_agents_md_placeholder(inputs)
});