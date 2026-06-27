import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Switch as ShadcnSwitch } from '@/ui/components/ui/switch'
import { Textarea } from '@/ui/components/ui/textarea'
import React from 'react'
import { PROVIDERS } from './constants'
import { ThinkingLevel } from './types'
import { m } from '@/ui/paraglide/messages.js'

// --- Section Header ---
export const SectionLabel: React.FC<{
  label: string
  subLabel?: string
  htmlFor?: string
}> = ({ label, subLabel, htmlFor }) => (
  <div className="mb-2">
    <Label htmlFor={htmlFor} className="block text-sm font-medium">
      {label}
    </Label>
    {subLabel && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subLabel}</p>}
  </div>
)

// --- Text Input ---
interface TextInputProps extends React.ComponentProps<typeof Input> {
  label: string
}

export const TextInput: React.FC<TextInputProps> = ({ label, className = '', id, ...props }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input className={className} id={id} {...props} />
  </div>
)

// --- Agent Type Selector ---
export const AgentTypeSelector: React.FC<{
  value: 'chat' | 'autofill'
  onChange: (val: 'chat' | 'autofill') => void
}> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <SectionLabel label={m.agent_type()} />
      <Select value={value} onValueChange={(val: 'chat' | 'autofill') => onChange(val)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={m.select_type()} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="chat">{m.chat_agent()}</SelectItem>
          <SelectItem value="autofill">{m.autofill_agent()}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

// --- Text Area ---
interface TextAreaProps extends React.ComponentProps<typeof Textarea> {
  label: string
  subLabel?: string
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  subLabel,
  className = '',
  id,
  ...props
}) => (
  <div className="space-y-2">
    <SectionLabel label={label} subLabel={subLabel} htmlFor={id} />
    <Textarea className={`resize-y min-h-[100px] ${className}`} id={id} {...props} />
  </div>
)

// --- Provider & Model Selector ---
interface ModelSelectorProps {
  provider: string | undefined
  model: string | undefined
  models: string[]
  onProviderChange: (p: string) => void
  onModelChange: (m: string) => void
  label?: string // Optional custom label
  subLabel?: string
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  provider,
  model,
  models,
  onProviderChange,
  onModelChange,
  label = m.ai_provider(),
  subLabel,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <SectionLabel label={label} subLabel={subLabel} />
        <Select value={provider || ''} onValueChange={(val) => onProviderChange(val)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={m.select_provider()} />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <SectionLabel label={m.model()} />
        <Select value={model || ''} onValueChange={(val) => onModelChange(val)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={m.select_model()} />
          </SelectTrigger>
          <SelectContent>
            {models.length > 0 ? (
              models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                {m.no_models_configured()}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// --- Thinking Level Selector ---
interface ThinkingLevelSelectorProps {
  value: ThinkingLevel | string | undefined
  onChange: (val: ThinkingLevel) => void
  disabled?: boolean
  label?: string
}

export const ThinkingLevelSelector: React.FC<ThinkingLevelSelectorProps> = ({
  value,
  onChange,
  disabled,
  label = m.thinking_strength(),
}) => {
  const levels = [
    {
      id: ThinkingLevel.DISABLED,
      label: m.thinking_disable(),
      desc: m.standard_generation(),
    },
    { id: ThinkingLevel.LOW, label: m.thinking_low(), desc: m.quick_reasoning() },
    { id: ThinkingLevel.MEDIUM, label: m.thinking_medium(), desc: m.balanced_thought() },
    { id: ThinkingLevel.HIGH, label: m.thinking_high(), desc: m.deep_reasoning() },
  ]

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none grayscale' : ''}>
      <SectionLabel label={label} subLabel={m.thinking_level_description()} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {levels.map((level) => {
          const isSelected = value === level.id
          return (
            <button
              key={level.id}
              onClick={(e) => {
                e.preventDefault()
                onChange(level.id)
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500 dark:ring-blue-400'
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <span
                className={`text-sm font-semibold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}
              >
                {level.label}
              </span>
              <span
                className={`text-[10px] mt-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-500'}`}
              >
                {level.desc}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- Toggle Switch ---
interface SwitchProps {
  label: string
  description?: string
  checked: boolean | undefined // Handle optional/undefined from API
  onChange: (checked: boolean) => void
}

export const Switch: React.FC<SwitchProps> = ({ label, description, checked, onChange }) => {
  const isChecked = !!checked
  return (
    <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
      <div className="space-y-0.5">
        <Label className="text-base cursor-pointer" onClick={() => onChange(!isChecked)}>
          {label}
        </Label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <ShadcnSwitch checked={isChecked} onCheckedChange={onChange} />
    </div>
  )
}
