import React from 'react';
import { Outlet } from 'react-router-dom';
import ClientSidebar from './ClientSidebar';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen pt-20">
      <ClientSidebar />
      <main className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

