"use client";

import React from "react";
import "./loader.css";

type LoaderProps = {
    size?: number; // px
    primaryColor?: string;
    secondaryColor?: string;
    className?: string;
    label?: string;
};

export default function Loader({ size = 48, primaryColor, secondaryColor, className = "", label }: LoaderProps) {
    const style = {
        // CSS variables consumed by loader.css
        // @ts-ignore - CSS variables
        "--loader-size": `${size}px`,
        "--loader-primary": primaryColor,
        "--loader-secondary": secondaryColor,
    } as React.CSSProperties;

    return (
        <div className={`flex flex-col items-center justify-center ${className}`} style={style}>
            <div className="loader" />
            {label ? <div className="mt-2 text-sm text-gray-500">{label}</div> : null}
        </div>
    );
}
