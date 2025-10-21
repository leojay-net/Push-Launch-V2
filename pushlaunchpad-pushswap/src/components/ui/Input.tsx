import { forwardRef, InputHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
    "flex w-full rounded-lg border bg-white px-4 py-3 text-base text-gray-900 font-medium transition-all placeholder:text-gray-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
                error:
                    "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20",
                success:
                    "border-green-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20",
            },
            inputSize: {
                sm: "h-9 px-3 py-2 text-sm",
                md: "h-11 px-4 py-3 text-base",
                lg: "h-13 px-5 py-4 text-lg",
            },
        },
        defaultVariants: {
            variant: "default",
            inputSize: "md",
        },
    }
);

export interface InputProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    rightElement?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            variant,
            inputSize,
            type = "text",
            label,
            error,
            helperText,
            leftIcon,
            rightIcon,
            rightElement,
            disabled,
            ...props
        },
        ref
    ) => {
        const finalVariant = error ? "error" : variant;

        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        type={type}
                        className={cn(
                            inputVariants({ variant: finalVariant, inputSize, className }),
                            leftIcon && "pl-10",
                            (rightIcon || rightElement) && "pr-10"
                        )}
                        ref={ref}
                        disabled={disabled}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                            {rightIcon}
                        </div>
                    )}
                    {rightElement && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {rightElement}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="mt-1.5 text-sm text-red-600">{error}</p>
                )}
                {helperText && !error && (
                    <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";

export default Input;
