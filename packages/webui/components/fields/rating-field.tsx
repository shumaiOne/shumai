import { Star } from 'lucide-react'
import React, { useState } from 'react'
import type { FieldProps } from './field-types'

const RatingField: React.FC<FieldProps<number>> = ({ value, config, onSave, readOnly }) => {
  const ratingConfig = config?.rating
  const max = Math.max(2, Math.min(6, ratingConfig?.maxValue || 5)) // Clamp 2-6
  const [hoverValue, setHoverValue] = useState<number | null>(null)

  const handleClick = (e: React.MouseEvent, rating: number) => {
    e.stopPropagation()
    if (readOnly) return

    let newValue
    if (value === rating) {
      newValue = 0 // Toggle off
    } else {
      newValue = rating
    }
    onSave(newValue)
  }

  const stars = Array.from({ length: max }, (_, i) => i + 1)

  return (
    <div
      className="flex items-center gap-1 h-[28px]"
      onMouseLeave={() => !readOnly && setHoverValue(null)}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {stars.map((star) => {
        const isFilled = hoverValue !== null ? star <= hoverValue : star <= (value || 0)
        return (
          <button
            key={star}
            onClick={(e) => handleClick(e, star)}
            onMouseEnter={() => !readOnly && setHoverValue(star)}
            className={`focus:outline-none transition-transform ${
              !readOnly ? 'cursor-pointer hover:scale-110' : 'cursor-default'
            }`}
            type="button"
            disabled={readOnly}
          >
            <Star
              className={`w-5 h-5 transition-colors ${
                isFilled ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-100 text-gray-300'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

export default RatingField
