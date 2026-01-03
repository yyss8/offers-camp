import React, { useState, useEffect } from 'react';

export default function ChangePasswordModal({ isOpen, onClose, onSubmit }) {
    const [step, setStep] = useState(1); // 1: current password, 2: verification code
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleRequestCode = async (e) => {
        e.preventDefault();
        setError('');

        if (!currentPassword) {
            setError('Please enter your current password');
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await onSubmit('request', { currentPassword });
            setStep(2);
        } catch (err) {
            setError(err.message || 'Failed to request password change');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setError('');

        if (!code || code.length !== 6) {
            setError('Please enter the 6-digit verification code');
            return;
        }

        setLoading(true);
        try {
            await onSubmit('verify', { newPassword, code });
            // Reset form
            setStep(1);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setCode('');
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setCode('');
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
                <h2 className="text-2xl font-semibold text-stone-900">
                    Change Password
                </h2>

                {step === 1 ? (
                    <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                disabled={loading}
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                disabled={loading}
                                minLength={6}
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                            >
                                {loading ? 'Sending...' : 'Send Verification Code'}
                            </button>
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={loading}
                                className="rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
                        <p className="text-sm text-stone-600">
                            A 6-digit verification code has been sent to your email. Please enter it below to complete the password change.
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-stone-700">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="mt-1 block w-full rounded-lg border border-stone-300 px-4 py-2 text-center text-2xl font-mono tracking-widest focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                placeholder="000000"
                                maxLength={6}
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                            >
                                {loading ? 'Changing...' : 'Change Password'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                disabled={loading}
                                className="rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                            >
                                Back
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
