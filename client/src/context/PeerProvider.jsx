// client/src/context/PeerProvider.jsx
import React, { useRef, useState } from 'react';
import PeerContext from './PeerContext';

export function PeerProvider({ children }) {
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);

  const value = {
    socketRef,
    localStreamRef,
    peersRef,
    peers,
    setPeers,
    localStream,
    setLocalStream
  };

  return <PeerContext.Provider value={value}>{children}</PeerContext.Provider>;
}

export default PeerProvider;
