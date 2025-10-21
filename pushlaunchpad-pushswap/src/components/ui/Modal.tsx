import { Fragment, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "./Button";

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: ReactNode;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    showCloseButton?: boolean;
    closeOnBackdropClick?: boolean;
    footer?: ReactNode;
}

const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw]",
};

const Modal = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = "md",
    showCloseButton = true,
    closeOnBackdropClick = true,
    footer,
}: ModalProps) => {
    const handleBackdropClick = () => {
        if (closeOnBackdropClick) {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={handleBackdropClick}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={cn(
                            "relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden",
                            sizeClasses[size]
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        {(title || showCloseButton) && (
                            <div className="flex items-start justify-between p-6 border-b border-gray-200">
                                <div className="flex-1">
                                    {title && (
                                        <h2 className="text-2xl font-semibold text-gray-900">
                                            {title}
                                        </h2>
                                    )}
                                    {description && (
                                        <p className="mt-1 text-sm text-gray-600">{description}</p>
                                    )}
                                </div>
                                {showCloseButton && (
                                    <button
                                        onClick={onClose}
                                        className="ml-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>

                        {/* Footer */}
                        {footer && (
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Modal;

// Confirmation Modal Helper
export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "primary" | "default";
    loading?: boolean;
}

export const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "primary",
    loading = false,
}: ConfirmModalProps) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant}
                        onClick={onConfirm}
                        loading={loading}
                        disabled={loading}
                    >
                        {confirmText}
                    </Button>
                </>
            }
        >
            <p className="text-gray-700">{message}</p>
        </Modal>
    );
};
