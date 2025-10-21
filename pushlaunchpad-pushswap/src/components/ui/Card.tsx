import { forwardRef, HTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
    "rounded-xl bg-white transition-all duration-200",
    {
        variants: {
            variant: {
                default: "border border-gray-200 shadow-sm hover:shadow-md",
                elevated: "shadow-lg hover:shadow-xl",
                outline: "border-2 border-gray-300",
                ghost: "border-none shadow-none hover:bg-gray-50",
            },
            padding: {
                none: "",
                sm: "p-4",
                md: "p-6",
                lg: "p-8",
            },
            interactive: {
                true: "cursor-pointer",
                false: "",
            },
        },
        defaultVariants: {
            variant: "default",
            padding: "md",
            interactive: false,
        },
    }
);

export interface CardProps
    extends Omit<
        HTMLAttributes<HTMLDivElement>,
        "color" | "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"
    >,
    VariantProps<typeof cardVariants> {
    hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
    (
        {
            className,
            variant,
            padding,
            interactive,
            hover = false,
            children,
            onClick,
            ...props
        },
        ref
    ) => {
        return (
            <motion.div
                ref={ref}
                className={cn(cardVariants({ variant, padding, interactive, className }))}
                onClick={onClick}
                whileHover={
                    hover || interactive ? { y: -4, transition: { duration: 0.2 } } : {}
                }
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

Card.displayName = "Card";

// Card Header Component
export const CardHeader = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5", className)}
        {...props}
    />
));
CardHeader.displayName = "CardHeader";

// Card Title Component
export const CardTitle = forwardRef<
    HTMLHeadingElement,
    HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn("text-xl font-semibold leading-none tracking-tight", className)}
        {...props}
    />
));
CardTitle.displayName = "CardTitle";

// Card Description Component
export const CardDescription = forwardRef<
    HTMLParagraphElement,
    HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-gray-600", className)}
        {...props}
    />
));
CardDescription.displayName = "CardDescription";

// Card Content Component
export const CardContent = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("pt-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

// Card Footer Component
export const CardFooter = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center pt-4", className)}
        {...props}
    />
));
CardFooter.displayName = "CardFooter";

export default Card;
