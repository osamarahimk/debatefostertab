import React, { ReactNode } from 'react';
import { SpinnerIcon } from './icons';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className, loading, ...props }) => {
  const baseClasses = 'px-4 py-2 rounded-md font-semibold focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border';
  const variantClasses = {
    primary: 'Button-primary',
    secondary: 'Button-secondary',
    danger: 'Button-danger',
    ghost: 'Button-ghost',
  };
  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <SpinnerIcon />}
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ className, ...props }) => {
  return (
    <input
      className={`Input-base ${className}`}
      {...props}
    />
  );
};

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`glass-card overflow-hidden ${className}`}>
      <div className="p-5">{children}</div>
    </div>
  );
};


interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 modal-backdrop flex justify-center items-center z-50 transition-opacity" onClick={onClose}>
            <div className={`glass-card w-full max-w-md mx-4 transform transition-all ${className}`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-[rgba(255,255,255,0.2)]">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="text-[var(--color-text-secondary)]">
                <p>{message}</p>
                <div className="flex justify-end gap-4 mt-6">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="danger" onClick={handleConfirm}>Confirm</Button>
                </div>
            </div>
        </Modal>
    );
};