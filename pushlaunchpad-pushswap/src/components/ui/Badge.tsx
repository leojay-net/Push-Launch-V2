import { forwardRef, HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center justify-center gap-1 rounded-full font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-gray-100 text-gray-700 border border-gray-300",
                primary: "bg-emerald-100 text-emerald-700 border border-emerald-300",
                success: "bg-green-100 text-green-700 border border-green-300",
                warning: "bg-yellow-100 text-yellow-700 border border-yellow-300",
                danger: "bg-red-100 text-red-700 border border-red-300",
                info: "bg-blue-100 text-blue-700 border border-blue-300",
                outline: "bg-transparent border-2 border-gray-300 text-gray-700",
            },
            size: {
                sm: "px-2 py-0.5 text-xs",
                md: "px-2.5 py-1 text-sm",
                lg: "px-3 py-1.5 text-base",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "md",
        },
    }
);

export interface BadgeProps
    extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
    dot?: boolean;
    icon?: React.ReactNode;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant, size, dot, icon, children, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(badgeVariants({ variant, size, className }))}
                {...props}
            >
                {dot && (
                    <span
                        className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            variant === "primary" && "bg-emerald-600",
                            variant === "success" && "bg-green-600",
                            variant === "warning" && "bg-yellow-600",
                            variant === "danger" && "bg-red-600",
                            variant === "info" && "bg-blue-600",
                            (variant === "default" || variant === "outline") && "bg-gray-600"
                        )}
                    />
                )}
                {icon && <span className="w-4 h-4">{icon}</span>}
                {children}
            </span>
        );
    }
);

Badge.displayName = "Badge";

export default Badge;
