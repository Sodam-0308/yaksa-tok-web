"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "white" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-sage-deep text-white hover:bg-sage-mid hover:shadow-lg hover:shadow-sage-deep/20",
  secondary:
    "bg-white text-text-mid border border-border hover:border-sage-light",
  white:
    "bg-white text-sage-deep hover:shadow-lg hover:shadow-black/15",
  ghost:
    "bg-transparent text-text-muted hover:bg-sage-pale",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-10 py-4 text-base font-semibold",
};

export default function Button({
  variant = "primary",
  size = "md",
  pill = true,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        font-medium font-body
        transition-all duration-200 ease-out
        cursor-pointer
        hover:-translate-y-0.5
        disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
        ${pill ? "rounded-full" : "rounded-[14px]"}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
