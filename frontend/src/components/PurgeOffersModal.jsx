import React, { useState } from "react";

export default function PurgeOffersModal({ onClose, onConfirm }) {
    const [selectedSources, setSelectedSources] = useState({
        amex: true,
        chase: true,
        citi: true
    });

    const handleToggle = (source) => {
        setSelectedSources(prev => ({
            ...prev,
            [source]: !prev[source]
        }));
    };

    const handleConfirm = () => {
        const sources = Object.keys(selectedSources).filter(s => selectedSources[s]);
        if (sources.length > 0) {
            onConfirm(sources);
        }
    };

    const hasSelection = Object.values(selectedSources).some(v => v);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <h2 className="text-xl font-semibold text-stone-900">
                    Purge Offers
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                    Select which sources to delete offers from:
                </p>

                <div className="mt-6 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selectedSources.amex}
                            onChange={() => handleToggle('amex')}
                            className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-stone-700">
                            American Express (Amex)
                        </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selectedSources.chase}
                            onChange={() => handleToggle('chase')}
                            className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-stone-700">
                            Chase
                        </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selectedSources.citi}
                            onChange={() => handleToggle('citi')}
                            className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-stone-700">
                            Citi
                        </span>
                    </label>
                </div>

                <div className="mt-8 flex gap-3">
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
                        disabled={!hasSelection}
                        className="flex-1 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Purge {hasSelection ? `(${Object.values(selectedSources).filter(v => v).length})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
