import React, { type SVGProps } from 'react'

/**
 * Common props for the icons, extending standard SVG attributes.
 */
type IconProps = SVGProps<SVGSVGElement>

/**
 * Shared props for consistent styling across this icon set.
 * Uses the Material Symbols coordinate system.
 */
const defaultProps: IconProps = {
  viewBox: '0 -960 960 960',
  fill: 'currentColor',
  xmlns: 'http://www.w3.org/2000/svg',
}

/**
 * Icon: Dock To Left (Outline)
 * Represents a window with a left sidebar panel.
 */
export const DockToLeft: React.FC<IconProps> = (props) => (
  <svg {...defaultProps} {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm120-80v-560H200v560h120Zm80 0h360v-560H400v560Z" />
  </svg>
)

/**
 * Icon: Dock To Right (Outline)
 * Represents a window with a right sidebar panel.
 */
export const DockToRight: React.FC<IconProps> = (props) => (
  <svg {...defaultProps} {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm360-80v-560H200v560h360Zm200 0v-560H640v560h120Z" />
  </svg>
)

/**
 * Icon: Dock To Left (Filled)
 * Represents a window where the left dock and frame are solid, highlighting the sidebar structure.
 */
export const DockToLeftFilled: React.FC<IconProps> = (props) => (
  <svg {...defaultProps} {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm560-80v-560H400v560h360Z" />
  </svg>
)

/**
 * Icon: Dock To Right (Filled)
 * Represents a window where the right dock and frame are solid, highlighting the sidebar structure.
 */
export const DockToRightFilled: React.FC<IconProps> = (props) => (
  <svg {...defaultProps} {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm360-80v-560H200v560h360Z" />
  </svg>
)

/**
 * Icon: Bot (Filled)
 * A filled version of the Bot icon, useful when the chatbot sidebar is active.
 */
export const BotFilled: React.FC<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 8V4H8" />
    <path
      d="M6 7H18A3 3 0 0 1 21 10V18A3 3 0 0 1 18 21H6A3 3 0 0 1 3 18V10A3 3 0 0 1 6 7ZM8 13V15A1 1 0 0 0 10 15V13A1 1 0 0 0 8 13ZM14 13V15A1 1 0 0 0 16 15V13A1 1 0 0 0 14 13Z"
      fill="currentColor"
      stroke="none"
    />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
  </svg>
)

export const NotificationFillIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={30}
    height={30}
    viewBox="120 -792 720 720"
    fill="none"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M 160 -180 v -72 h 80 v -252 q 0 -74.7 50 -132.75 T 420 -712.8 v -25.2 q 0 -22.5 17.5 -38.25 T 480 -792 q 25 0 42.5 15.75 T 540 -738 v 25.2 q 80 18 130 76.05 T 720 -504 v 252 h 80 v 72 H 160 Z M 480 -72 q -33 0 -56.5 -21.15 T 400 -144 h 160 q 0 29.7 -23.5 50.85 T 480 -72 Z"
      fill="currentColor"
    />
  </svg>
)

export const DrawAnnotation: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M10.77 10.377a1 1 0 0 0-.132.437l-.105 1.665a.5.5 0 0 0 .793.436l1.32-.96a1 1 0 0 0 .278-.309l3.912-6.775a1.25 1.25 0 1 0-2.165-1.25l-3.901 6.756Z"
      fill="currentColor"
    />
    <path
      d="M11.016 6.75a.758.758 0 0 1-.758.748c-2.938 0-4.882 1.71-5.517 3.95-.708 2.499.245 4.459 1.979 5.851 1.767 1.42 4.31 2.203 6.547 2.203.415 0 .749.335.745.748a.758.758 0 0 1-.758.748c-2.536 0-5.421-.873-7.485-2.531-2.098-1.686-3.38-4.225-2.475-7.414.818-2.883 3.354-5.051 6.977-5.051.415 0 .749.335.745.748Z"
      fill="currentColor"
    />
    <path
      d="M17.147 8.315a.767.767 0 0 1 1.058-.168c1.666 1.188 2.508 2.542 2.733 3.876a4.5 4.5 0 0 1-.805 3.392c-.919 1.434-2.714 2.074-4.479 2.185-1.799.113-3.78-.302-5.292-1.216a.733.733 0 0 1-.242-1.022.768.768 0 0 1 1.042-.246c1.216.734 2.881 1.096 4.409 1 1.553-.097 2.755-.647 3.292-1.5l.015-.022.015-.021a3.025 3.025 0 0 0 .553-2.294c-.148-.876-.72-1.915-2.137-2.926a.733.733 0 0 1-.162-1.038Z"
      fill="currentColor"
    />
  </svg>
)

export const ShumaiLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <clipPath id="bg-clip">
          <rect x="5" y="5" width="90" height="90" rx="22" />
        </clipPath>
      </defs>

      {/* Background */}
      <rect x="5" y="5" width="90" height="90" rx="22" fill="#D95A66" />

      {/* Long Shadow */}
      <path
        d="M 35 75 L 65 75 L 80 60 L 75 30 L 175 130 L 135 175 Z"
        fill="#A8384D"
        clipPath="url(#bg-clip)"
      />

      {/* Left Cream */}
      <path d="M 25 30 Q 38 36 50 42 L 35 55 L 35 75 L 20 60 Z" fill="#FDF0D5" />

      {/* Right Orange */}
      <path d="M 50 42 Q 62 36 75 30 L 80 60 L 65 75 L 65 55 Z" fill="#E77A65" />

      {/* Front Peach */}
      <path d="M 35 75 L 65 75 L 65 55 L 50 42 L 35 55 Z" fill="#F5B895" />

      {/* Top Pink */}
      <path d="M 50 42 Q 38 36 25 30 Q 38 26 50 20 Q 62 26 75 30 Q 62 36 50 42 Z" fill="#F4B8B8" />

      {/* Hole Left */}
      <path d="M 50 25 L 42 30 L 50 35 Z" fill="#E57A5F" />

      {/* Hole Right */}
      <path d="M 50 25 L 58 30 L 50 35 Z" fill="#C2523C" />
    </svg>
  )
}

export const HomeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="24 24 152 152"
    fill="none"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M 44 170 L 44 100 L 24 100 L 100 30 L 126 54 L 126 36 L 142 36 L 142 69 L 176 100 L 156 100 L 156 170 L 120 170 L 120 136 A 20 20 0 0 0 80 136 L 80 170 Z"
      fill="currentColor"
    />
  </svg>
)

interface UploadCloudIconProps extends React.SVGProps<SVGSVGElement> {
  uploading?: boolean
  className?: string
}

/**
 * Custom UploadCloudIcon component.
 * Replaces the animated version with a custom SVG while maintaining prop compatibility.
 */
export function UploadCloudIcon({
  uploading = false,
  className = '',
  ...props
}: UploadCloudIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="15 15 70 70"
      width={30}
      height={30}
      className={`${className} ${uploading ? 'animate-upload-breathing' : ''}`}
      aria-hidden="true"
      focusable="false"
      style={uploading ? { transformOrigin: 'center' } : undefined}
      {...props}
    >
      {uploading && (
        <defs>
          <linearGradient id="upload-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6">
              <animate
                attributeName="stop-color"
                values="#3b82f6;#ec4899;#8b5cf6;#3b82f6"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor="#8b5cf6">
              <animate
                attributeName="stop-color"
                values="#8b5cf6;#3b82f6;#ec4899;#8b5cf6"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#ec4899">
              <animate
                attributeName="stop-color"
                values="#ec4899;#8b5cf6;#3b82f6;#ec4899"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
      )}
      <path
        d="M 44.1 75 H 30 A 15 15 0 0 1 30 45 A 20 20 0 0 1 70 45 A 15 15 0 0 1 70 75 H 55.9 V 60.2 H 61.9 L 50 45.3 L 38.1 60.2 H 44.1 Z"
        fill={uploading ? 'url(#upload-gradient)' : 'currentColor'}
      />
    </svg>
  )
}

export const KanbanFillIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -960 960 960"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    className={className ? `rotate-180 ${className}` : 'rotate-180'}
    {...props}
  >
    <path d="M172-84q-36.3 0-62.15-25.85T84-172v-616q0-36.3 25.85-62.15T172-876h616q36.3 0 62.15 25.85T876-788v616q0 36.3-25.85 62.15T788-84H172Zm88-176h88v-440h-88v440Zm176 0h88v-264h-88v264Zm176 0h88v-352h-88v352Z" />
  </svg>
)

export const DashboardFillIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -960 960 960"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path d="M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120Z" />
  </svg>
)
