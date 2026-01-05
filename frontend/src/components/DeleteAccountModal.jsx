import React, { useState } from "react";

export default function DeleteAccountModal({ username, onClose, onConfirm }) {
    const [inputUsername, setInputUsername] = useState("");

    const handleConfirm = () => {
        onConfirm(inputUsername);
    };

    const isValid = inputUsername.trim() === username;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <h2 className="text-xl font-semibold text-red-600">
                    Delete Account
                </h2>

                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
                    <p className="text-sm font-semibold text-red-800">
                        ⚠️ Warning: This action cannot be undone!
                    </p>
                    <p className="mt-2 text-sm text-red-700">
                        All your data including offers will be permanently deleted.
                    </p>
                </div>

                <p className="mt-4 text-sm text-stone-700">
                    To confirm, please type your username:{" "}
                    <span className="font-semibold text-stone-900">{username}</span>
                </p>

                <input
                    type="text"
                    value={inputUsername}
                    onChange={(e) => setInputUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="mt-3 w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200"
                    autoFocus
                />

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className="flex-1 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    );
}
