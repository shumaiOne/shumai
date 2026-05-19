import React, { type SVGProps } from "react";

/**
 * Common props for the icons, extending standard SVG attributes.
 */
type IconProps = SVGProps<SVGSVGElement>;

/**
 * Shared props for consistent styling across this icon set.
 * Uses the Material Symbols coordinate system.
 */
const defaultProps: IconProps = {
  viewBox: "0 -960 960 960",
  fill: "currentColor",
  xmlns: "http://www.w3.org/2000/svg",
};

/**
 * Icon: Dock To Left (Outline)
 * Represents a window with a left sidebar panel.
 */
export const DockToLeft: React.FC<IconProps> = (props) => (
  <svg {...defaultProps} {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm120-80v-560H200v560h120Zm80 0h360v-560H400v560Z" />
  </svg>
);

/**
 * Icon: Dock To Right (Outline)
 * Represents a window with a right sidebar panel.
 */
export const DockToRight: React.FC<IconProps> = (props) => (
  <svg {...defaultProps} {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm360-80v-560H200v560h360Zm200 0v-560H640v560h120Z" />
  </svg>
);

/**
 * Icon: Dock To Left (Filled)
 * Represents a window where the left dock and frame are solid, highlighting the sidebar structure.
 */
export const DockToLeftFilled: React.FC<IconProps> = (props) => (
  <svg {...defaultProps} {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm560-80v-560H400v560h360Z" />
  </svg>
);

/**
 * Icon: Dock To Right (Filled)
 * Represents a window where the right dock and frame are solid, highlighting the sidebar structure.
 */
export const DockToRightFilled: React.FC<IconProps> = (props) => (
  <svg {...defaultProps} {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm360-80v-560H200v560h360Z" />
  </svg>
);

export const NotificationFillIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 -960 960 960"
    fill="none"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160ZM480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80Z"
      fill="currentColor"
    />
  </svg>
);

export const DrawAnnotation: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
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
);

export const ShumaiLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
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
      <path
        d="M 25 30 Q 38 36 50 42 L 35 55 L 35 75 L 20 60 Z"
        fill="#FDF0D5"
      />

      {/* Right Orange */}
      <path
        d="M 50 42 Q 62 36 75 30 L 80 60 L 65 75 L 65 55 Z"
        fill="#E77A65"
      />

      {/* Front Peach */}
      <path d="M 35 75 L 65 75 L 65 55 L 50 42 L 35 55 Z" fill="#F5B895" />

      {/* Top Pink */}
      <path
        d="M 50 42 Q 38 36 25 30 Q 38 26 50 20 Q 62 26 75 30 Q 62 36 50 42 Z"
        fill="#F4B8B8"
      />

      {/* Hole Left */}
      <path d="M 50 25 L 42 30 L 50 35 Z" fill="#E57A5F" />

      {/* Hole Right */}
      <path d="M 50 25 L 58 30 L 50 35 Z" fill="#C2523C" />
    </svg>
  );
};
