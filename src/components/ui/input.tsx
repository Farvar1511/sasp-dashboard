import * as React from "react"

import { cn } from "../../lib/utils"

// Define the props, including the ref which will be forwarded
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// Wrap the component definition with React.forwardRef
const InputComponent = React.forwardRef<HTMLInputElement, InputProps>( // Rename inner component
  ({ className, type, ...props }, ref) => {
    // console.log("Rendering Input"); // Optional: Add log for debugging if needed
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className
        )}
        ref={ref} // Pass the forwarded ref to the actual input element
        {...props}
      />
    )
  }
)
// Set display name for inner component for better debugging
InputComponent.displayName = "InputComponent"

// Memoize the forwarded ref component
export const Input = React.memo(InputComponent);
// Set display name for better debugging
Input.displayName = "Input"

// export { Input } // Remove old export
