'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { createContext, useContext, useState, ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    duration?: number;
}

interface NotificationContextType {
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = (notification: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNotification = { ...notification, id };

        setNotifications(prev => [...prev, newNotification]);

        // Auto remove after duration (default 5 seconds)
        const duration = notification.duration || 5000;
        setTimeout(() => {
            removeNotification(id);
        }, duration);
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };



    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
            <NotificationContainer />
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}

function NotificationContainer() {
    const { notifications, removeNotification } = useNotification();

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
            <AnimatePresence>
                {notifications.map((notification) => (
                    <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRemove={removeNotification}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}

function NotificationItem({
    notification,
    onRemove
}: {
    notification: Notification;
    onRemove: (id: string) => void;
}) {
    const icons = {
        success: CheckCircle,
        error: XCircle,
        warning: AlertCircle,
        info: Info,
    };

    const colors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    const iconColors = {
        success: 'text-green-600',
        error: 'text-red-600',
        warning: 'text-yellow-600',
        info: 'text-blue-600',
    };

    const Icon = icons[notification.type];

    return (
        <motion.div
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className={`w-full border rounded-lg p-4 shadow-lg ${colors[notification.type]}`}
        >
            <div className="flex items-start">
                <Icon className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${iconColors[notification.type]}`} />
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    {notification.message && (
                        <p className="text-sm opacity-80 mt-1 break-words">{notification.message}</p>
                    )}
                </div>
                <button
                    onClick={() => onRemove(notification.id)}
                    className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}
