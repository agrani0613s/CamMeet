import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Meeting from './pages/Meeting';
import { PeerProvider } from './context/PeerContext';

export default function App() {
  return (
    <PeerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Meeting />} />
        </Routes>
      </BrowserRouter>
    </PeerProvider>
  );
}
