import { forwardRef, ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-gray-900 text-white font-semibold hover:bg-gray-800 shadow-md hover:shadow-lg",
                primary:
                    "bg-emerald-500 text-white font-semibold hover:bg-emerald-600 shadow-md hover:shadow-lg shadow-emerald-500/20",
                outline:
                    "border-2 border-gray-300 bg-transparent text-gray-900 font-semibold hover:bg-gray-50 hover:border-gray-400",
                ghost:
                    "bg-transparent hover:bg-gray-100 text-gray-900 font-semibold hover:text-gray-900",
                danger:
                    "bg-red-500 text-white font-semibold hover:bg-red-600 shadow-md hover:shadow-lg",
                success:
                    "bg-green-500 text-white font-semibold hover:bg-green-600 shadow-md hover:shadow-lg",
            },
            size: {
                sm: "h-9 px-3 text-sm",
                md: "h-11 px-5 text-base",
                lg: "h-13 px-7 text-lg",
                icon: "h-10 w-10",
            },
            fullWidth: {
                true: "w-full",
                false: "",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "md",
            fullWidth: false,
        },
    }
);

export interface ButtonProps
    extends Omit<
        ButtonHTMLAttributes<HTMLButtonElement>,
        "color" | "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
    >,
    VariantProps<typeof buttonVariants> {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            fullWidth,
            loading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            type = "button",
            onClick,
            ...props
        },
        ref
    ) => {
        return (
            <motion.button
                ref={ref}
                type={type}
                className={cn(buttonVariants({ variant, size, fullWidth, className }))}
                disabled={disabled || loading}
                onClick={onClick}
                whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
                whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
                transition={{ duration: 0.15 }}
                {...props}
            >
                {loading && (
                    <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                )}
                {!loading && leftIcon}
                {children}
                {!loading && rightIcon}
            </motion.button>
        );
    }
);

Button.displayName = "Button";

export default Button;
