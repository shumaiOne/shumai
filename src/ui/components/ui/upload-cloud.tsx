import React, { useId } from "react";

interface UploadCloudIconProps extends React.SVGProps<SVGSVGElement> {
  uploading?: boolean;
  className?: string;
}

const CLOUD_PATH =
  "M17.5 19C19.9853 19 22 16.9853 22 14.5C22 12.132 20.177 10.244 17.819 10.035C17.65 6.94 15.11 4.5 12 4.5C9.22 4.5 6.91 6.47 6.32 9.1C3.89 9.5 2 11.5 2 14C2 16.76 4.24 19 7 19H17.5Z";
const ARROW_PATH = "M12 6.5L16 10.5L14.6 11.9L12 9.3L9.4 11.9L8 10.5L12 6.5Z";

export function UploadCloudIcon({
  uploading = false,
  className = "",
  ...props
}: UploadCloudIconProps) {
  const id = useId();
  const safeId = id.replace(/:/g, "");
  const clipId = `cloud-clip-${safeId}`;
  const maskId = `cloud-mask-${safeId}`;
  const launchAnimId = `launch-${safeId}`;
  const spinAnimId = `spin-${safeId}`;

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: "visible" }}
      {...props}
    >
      <style>
        {`
          @keyframes ${launchAnimId} {
            0% { transform: translateY(3px); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateY(-6px); opacity: 0; }
          }
          @keyframes ${spinAnimId} {
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <defs>
        {/*
           Scaled clip path for uploading state.
           Scaling down the cloud path creates the requested "padding"
           between the cloud border and the animating arrow.
        */}
        <clipPath id={clipId}>
          <path
            d={CLOUD_PATH}
            transform="translate(12, 12) scale(0.75) translate(-12, -12)"
          />
        </clipPath>

        {/*
           Mask for static state.
           This creates a transparent "cutout" of the arrow in the center of the cloud.
        */}
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          {/* Translated down by 2.5px to visually center the arrow in the cloud body */}
          <path d={ARROW_PATH} fill="black" transform="translate(0, 2.5)" />
        </mask>
      </defs>

      {/*
        Cloud Background
        - Static: Uses mask to show cutout arrow.
        - Uploading: No mask (solid fill), arrow rendered on top.
      */}
      <path
        d={CLOUD_PATH}
        fill="currentColor"
        mask={!uploading ? `url(#${maskId})` : undefined}
        style={{ transition: "all 0.2s ease" }}
      />

      {/*
        Animated Arrow
        Only visible when uploading.
        It is white (to contrast with the colored cloud) and clipped by the scaled cloud shape.
      */}
      <g
        clipPath={`url(#${clipId})`}
        style={{ opacity: uploading ? 1 : 0, transition: "opacity 0.2s" }}
      >
        <path
          d={ARROW_PATH}
          fill="white"
          style={
            uploading
              ? {
                  animation: `${launchAnimId} 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
                }
              : {}
          }
        />
      </g>

      {/*
        Spinning Blue Arc
        r="12.5" places it outside the 24x24 box (diameter 25).
        overflow: visible on SVG ensures it's seen.
      */}
      <circle
        cx="12"
        cy="12"
        r="12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="9.8 68.7"
        fill="none"
        style={{
          transformOrigin: "center",
          animation: `${spinAnimId} 1s linear infinite`,
          opacity: uploading ? 1 : 0,
          transition: "opacity 0.3s ease-in-out",
          pointerEvents: "none",
        }}
      />
    </svg>
  );
}
