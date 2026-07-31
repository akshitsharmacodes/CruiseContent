import React from 'react';
import { useQuery } from '@tanstack/react-query';

const fetchStatus = async () => {
    const res = await fetch('http://localhost:8000/api/dashboard/status/');
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
};

export default function Dashboard() {
    const { data, error, isLoading } = useQuery({
        queryKey: ['dashboardStatus'],
        queryFn: fetchStatus
    });

    if (isLoading) return <div className="p-8 text-center text-gray-500 font-inter">Loading API data...</div>;
    if (error) return <div className="p-8 text-center text-red-500 font-inter">Error connecting to backend: {error.message}</div>;

    return (
        <div className="p-8 bg-gray-50 min-h-screen font-inter">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-light text-gray-900 mb-6">Automated Content Engine Dashboard</h1>
                
                <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-blue-50 text-blue-900 rounded-lg">
                        <p className="text-sm font-medium uppercase tracking-wider opacity-80">Pending Drafts</p>
                        <p className="text-4xl font-bold mt-2">{data.pending_drafts}</p>
                    </div>
                    <div className="p-6 bg-green-50 text-green-900 rounded-lg">
                        <p className="text-sm font-medium uppercase tracking-wider opacity-80">API Status</p>
                        <p className="text-xl font-bold mt-2">{data.message}</p>
                    </div>
                </div>
                
                <div className="mt-8">
                    <h2 className="text-lg font-medium text-gray-700 mb-3">Connected Platforms</h2>
                    <div className="flex gap-3">
                        {data.connected_platforms.map((platform) => (
                            <span key={platform} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                                {platform.replace('_', ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
