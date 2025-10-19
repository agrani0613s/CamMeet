// import { useContext } from 'react';
// import { PeerContext } from './PeerContext';

// export default function usePeer() {
//   const ctx = useContext(PeerContext);
//   if (!ctx) throw new Error('usePeer must be used within PeerProvider');
//   return ctx;
// }

// client/src/context/usePeer.js
import { useContext } from 'react';
import PeerContext from './PeerContext';

export default function usePeer() {
  const ctx = useContext(PeerContext);
  if (!ctx) throw new Error('usePeer must be used within PeerProvider');
  return ctx;
}
