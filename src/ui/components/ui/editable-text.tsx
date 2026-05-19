import { Input } from "@/ui/components/ui/input";
import { cn } from "@/ui/lib/utils";
import React from "react";

export type EditableTextProps = React.ComponentPropsWithoutRef<"input">;

const EditableText = React.forwardRef<HTMLInputElement, EditableTextProps>(
  ({ className, onClick, onMouseDown, ...props }, ref) => {
    return (
      <Input
        className={cn(
          "h-auto min-h-0 w-full rounded-sm border px-1 py-0.5 text-base shadow-none transition-all outline-none focus-visible:ring-0",
          !props.disabled
            ? "border-blue-500 bg-muted/10 ring-1 ring-blue-500"
            : "border-transparent bg-transparent cursor-default opacity-100 disabled:opacity-100 disabled:cursor-default disabled:pointer-events-auto",
          className,
        )}
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onMouseDown?.(e);
        }}
        {...props}
      />
    );
  },
);

EditableText.displayName = "EditableText";

export { EditableText };
