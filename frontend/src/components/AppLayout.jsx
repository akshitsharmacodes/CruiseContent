import React from 'react';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="pt-24 lg:pt-28">
      <Outlet />
    </div>
  );
}
