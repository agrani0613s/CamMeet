import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams, useNavigate  } from 'react-router-dom';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function Meeting() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const name = state?.name || 'Guest';
  const isCreator = state?.isCreator || false;

  // signaling refs/state
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});

  // UI / app state
  const [remoteStreams, setRemoteStreams] = useState({});
  const [chat, setChat] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [selectedTile, setSelectedTile] = useState(null); // 'local' or socketId
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(true);

  // navigation for leaving/redirects
  const navigate = useNavigate();

  // centralized cleanup (same logic used in useEffect cleanup but callable on-demand)
  const cleanupAndLeave = () => {
    try {
      // close RTCPeerConnections
      if (peersRef.current && typeof peersRef.current === 'object') {
        Object.values(peersRef.current).forEach(pc => {
          if (pc && typeof pc.close === 'function') {
            try { pc.close(); } catch (err) { console.warn('Peer close failed:', err); }
          }
        });
        peersRef.current = {};
      }
    } catch (err) {
      console.warn('Error closing peers during cleanup', err);
    }

    try {
      // stop local tracks
      if (localStreamRef.current instanceof MediaStream) {
        try {
          localStreamRef.current.getTracks().forEach(track => {
            if (track && typeof track.stop === 'function') track.stop();
          });
        } catch (err) {
          console.warn('Error stopping local tracks during cleanup', err);
        } finally {
          localStreamRef.current = null;
        }
      }
    } catch (err) {
      console.warn('Error during local track cleanup', err);
    }

    try {
      // disconnect socket safely
      const sock = socketRef.current;
      if (sock) {
        try {
          if (typeof sock.removeAllListeners === 'function') sock.removeAllListeners();
          else if (typeof sock.off === 'function') sock.off();
        } catch (err) {
          console.warn('Error removing socket listeners', err);
        }
        try {
          if (typeof sock.disconnect === 'function') sock.disconnect();
        } catch (err) {
          console.warn('Error disconnecting socket', err);
        }
        socketRef.current = null;
      }
    } catch (err) {
      console.warn('Socket cleanup error', err);
    }

    // safely navigate home
    setTimeout(() => {
  try {
    navigate('/');
  } catch {
    window.location.href = '/';
  }
}, 100);
  };

  // Called when user clicks End Meeting
  const endMeeting = () => {
    // If creator, ask server to end the room (server should broadcast 'room-ended' to all clients).
    if (isCreator) {
      try {
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('end-room', { roomId });
        }
      } catch (err) {
        console.warn('emit end-room failed', err);
      }
      // Also run local cleanup immediately for the host
      cleanupAndLeave();
      return;
    }

    // Non-host users simply leave locally
    cleanupAndLeave();
  };

  // overlay (local camera shown during screen share) - position and size (viewport coords)
  const [overlay, setOverlay] = useState({
    x: 20, y: 20, w: 240, h: 160,
    dragging: false, resizing: false, offsetX: 0, offsetY: 0
  });

  // new: scale for expanded tile (1 = default). Users can zoom in/out the expanded window.
  const [expandedScale, setExpandedScale] = useState(1);

  useEffect(() => {
    const s = io(SERVER_URL);
    socketRef.current = s;
    let mounted = true;

    function addChat(msg) {
      setChat(prev => [...prev, msg]);
    }

    async function startLocalCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current && !isScreenSharing) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.warn('getUserMedia error', err);
        alert('Unable to access camera/microphone: ' + (err?.message || err));
      }
    }
    startLocalCamera();

    // signaling helpers (kept inside useEffect to avoid stale deps)
    // async function createPeerConnection(peerSocketId) {
    //   const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    //   if (localStreamRef.current) {
    //     try {
    //       localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    //     } catch (err) {
    //       console.warn('Error adding local tracks', err);
    //     }
    //   }

    //   pc.ontrack = (ev) => {
    //     if (!mounted) return;
    //     setRemoteStreams(prev => ({ ...prev, [peerSocketId]: ev.streams[0] }));
    //   };

    //   pc.onicecandidate = (event) => {
    //     if (event.candidate && socketRef.current && socketRef.current.connected) {
    //       socketRef.current.emit('ice-candidate', { to: peerSocketId, candidate: event.candidate, from: socketRef.current.id });
    //     }
    //   };



    //   peersRef.current[peerSocketId] = pc;
    //   return pc;
    // }

    // Signaling handlers
    async function createPeerConnection(peerSocketId) {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      pc.ontrack = ev => setRemoteStreams(prev => ({ ...prev, [peerSocketId]: ev.streams[0] }));
      pc.onicecandidate = e => {
        if (e.candidate) socketRef.current?.emit('ice-candidate', { to: peerSocketId, candidate: e.candidate, from: socketRef.current.id });
      };
      peersRef.current[peerSocketId] = pc;
      return pc;
    }

    // async function createOffer(targetSocketId) {
    //   let pc = peersRef.current[targetSocketId];
    //   if (!pc) pc = await createPeerConnection(targetSocketId);
    //   const offer = await pc.createOffer();
    //   await pc.setLocalDescription(offer);
    //   if (socketRef.current && socketRef.current.connected) {
    //     socketRef.current.emit('offer', { to: targetSocketId, sdp: pc.localDescription, from: socketRef.current.id, name });
    //   }
    // }
    async function createOffer(targetSocketId) {
      let pc = peersRef.current[targetSocketId] || await createPeerConnection(targetSocketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('offer', { to: targetSocketId, sdp: pc.localDescription, from: socketRef.current.id, name });
    }

    // async function handleOffer(from, sdp) {
    //   let pc = peersRef.current[from];
    //   if (!pc) pc = await createPeerConnection(from);
    //   try {
    //     await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    //   } catch (err) {
    //     console.warn('setRemoteDescription failed', err);
    //   }
    //   const answer = await pc.createAnswer();
    //   await pc.setLocalDescription(answer);
    //   if (socketRef.current && socketRef.current.connected) {
    //     socketRef.current.emit('answer', { to: from, sdp: pc.localDescription, from: socketRef.current.id });
    //   }
    // }
    async function handleOffer(from, sdp) {
      let pc = peersRef.current[from] || await createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('answer', { to: from, sdp: pc.localDescription, from: socketRef.current.id });
    }

    // socket handlers
    s.on('connect', () => {
      if (isCreator) s.emit('create-room', { roomId, name });
      else s.emit('join-room', { roomId, name });
    });

    s.on('user-joined', async ({ socketId }) => {
      try { await createOffer(socketId); } catch (err) { console.warn('createOffer error', err); }
    });

    s.on('existing-participants', async (list) => {
      for (const p of list) {
        try { await createOffer(p.socketId); } catch (err) { console.warn('createOffer (existing) error', err); }
      }
    });

    s.on('offer', async ({ from, sdp }) => {
      try { await handleOffer(from, sdp); } catch (err) { console.warn('handleOffer error', err); }
    });

    s.on('answer', async ({ from, sdp }) => {
      const pc = peersRef.current[from];
      if (pc) {
        try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); } catch (err) { console.warn('setRemoteDescription (answer) failed', err); }
      }
    });

    s.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc && candidate) {
        try { await pc.addIceCandidate(candidate); } catch (err) { console.warn('addIceCandidate failed', err); }
      }
    });

    s.on('user-left', ({ socketId }) => {
      try {
        if (peersRef.current && peersRef.current[socketId]) {
          const pc = peersRef.current[socketId];
          if (pc && typeof pc.close === 'function') {
            try { pc.close(); } catch (closeErr) { console.warn('Error closing pc', closeErr); }
          }
          try { delete peersRef.current[socketId]; } catch (delErr) { console.warn('Error deleting peer ref', delErr); }
        }
        setRemoteStreams(prev => {
          if (!prev || typeof prev !== 'object') return prev;
          const copy = { ...prev };
          if (copy[socketId]) delete copy[socketId];
          return copy;
        });
      } catch (e) {
        console.warn('user-left handler failed', e);
      }
    });

    // server can broadcast 'room-ended' to force everyone out
    s.on('room-ended', ({ roomId: endedRoomId }) => {
      // optional: only act if same room (defensive)
      if (!endedRoomId || endedRoomId === roomId) {
        alert('Meeting has been ended by the host.');
        cleanupAndLeave();
      }
    });


    s.on('chat-message', ({ name: senderName, message, time }) => {
      addChat({ name: senderName, message, time });
    });

    // cleanup
    return () => {
      mounted = false;
      if (peersRef.current && typeof peersRef.current === 'object') {
        Object.values(peersRef.current).forEach(pc => {
          if (pc && typeof pc.close === 'function') {
            try { pc.close(); } catch (err) { console.warn('Peer close failed:', err); }
          }
        });
        peersRef.current = {};
      }

      if (localStreamRef.current instanceof MediaStream) {
        try { localStreamRef.current.getTracks().forEach(track => { if (track && typeof track.stop === 'function') track.stop(); }); } catch (err) { console.warn('Error stopping tracks', err); } finally { localStreamRef.current = null; }
      }

      const sock = socketRef.current;
      if (sock) {
        try { if (typeof sock.removeAllListeners === 'function') sock.removeAllListeners(); else if (typeof sock.off === 'function') sock.off(); } catch (err) { console.warn('Error removing socket listeners', err); }
        try { if (typeof sock.disconnect === 'function') sock.disconnect(); } catch (err) { console.warn('Error disconnecting socket', err); }
        socketRef.current = null;
      }
    };
  }, [isCreator, name, roomId]);

  // Controls
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = !t.enabled));
    setMuted(prev => !prev);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(t => (t.enabled = !t.enabled));
    setCamOn(prev => !prev);
  };

  // Screen share: replace outgoing video track for peers, show screen locally,
  // and manage overlay (overlay remains available while sharing)
  // const shareScreen = async () => {
  //   if (isScreenSharing) {
  //     // stop screen sharing: restore camera locally & to peers
  //     if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
  //     for (const pid in peersRef.current) {
  //       const pc = peersRef.current[pid];
  //       const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
  //       if (senders[0] && localStreamRef.current?.getVideoTracks()[0]) {
  //         try { await senders[0].replaceTrack(localStreamRef.current.getVideoTracks()[0]); } catch (err) { console.warn('replaceTrack restore error', err); }
  //       }
  //     }
  //     setIsScreenSharing(false);
  //     return;
  //   }

  //   try {
  //     const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  //     if (!screenStream) return;
  //     if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
  //     const screenTrack = screenStream.getVideoTracks()[0];
  //     for (const pid in peersRef.current) {
  //       const pc = peersRef.current[pid];
  //       const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
  //       if (senders[0]) {
  //         try { await senders[0].replaceTrack(screenTrack); } catch (err) { console.warn('replaceTrack to peers failed', err); }
  //       }
  //     }
  //     setIsScreenSharing(true);

  //     screenTrack.onended = async () => {
  //       try {
  //         if (localStreamRef.current && localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
  //         for (const pid in peersRef.current) {
  //           const pc = peersRef.current[pid];
  //           const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
  //           if (senders[0] && localStreamRef.current?.getVideoTracks()[0]) {
  //             try { await senders[0].replaceTrack(localStreamRef.current.getVideoTracks()[0]); } catch (err) { console.warn('restore after screen end failed', err); }
  //           }
  //         }
  //       } catch (err) {
  //         console.warn('error while restoring camera after screen share', err);
  //       } finally {
  //         setIsScreenSharing(false);
  //       }
  //     };
  //   } catch (err) {
  //     console.warn('Screen share failed', err);
  //   }
  // };

  const shareScreen = async () => {
    if (isScreenSharing) {
      localVideoRef.current.srcObject = localStreamRef.current;
      Object.values(peersRef.current).forEach(async pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(localStreamRef.current?.getVideoTracks()[0]);
      });
      setIsScreenSharing(false);
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (!screenStream) return;
      localVideoRef.current.srcObject = screenStream;
      Object.values(peersRef.current).forEach(async pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenStream.getVideoTracks()[0]);
      });
      setIsScreenSharing(true);
      screenStream.getVideoTracks()[0].onended = () => {
        localVideoRef.current.srcObject = localStreamRef.current;
        Object.values(peersRef.current).forEach(async pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(localStreamRef.current?.getVideoTracks()[0]);
        });
        setIsScreenSharing(false);
      };
    } catch {
      console.warn('Screen share failed');
     }
  };

  // Chat send
  const sendChat = (text) => {
    if (!text || !socketRef.current) return;
    socketRef.current.emit('chat-message', { roomId, message: text, name });
    setChat(prev => [...prev, { name: 'You', message: text, time: new Date().toISOString() }]);
  };

  // Tile click
  const handleTileClick = (id) => {
    setSelectedTile(prev => (prev === id ? null : id));
    // reset scale when changing selection
    setExpandedScale(1);
  };

  // Overlay drag & resize handlers (used when overlay is shown)
  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    setOverlay(prev => ({ ...prev, dragging: true, offsetX: startX - prev.x, offsetY: startY - prev.y }));
    window.addEventListener('mousemove', dragMove);
    window.addEventListener('mouseup', endDrag);
  };
  const dragMove = (e) => {
    setOverlay(prev => {
      if (!prev.dragging) return prev;
      const newX = e.clientX - prev.offsetX;
      const newY = e.clientY - prev.offsetY;
      return { ...prev, x: Math.max(8, Math.min(newX, window.innerWidth - prev.w - 8)), y: Math.max(8, Math.min(newY, window.innerHeight - prev.h - 8)) };
    });
  };
  const endDrag = () => {
    setOverlay(prev => ({ ...prev, dragging: false }));
    window.removeEventListener('mousemove', dragMove);
    window.removeEventListener('mouseup', endDrag);
  };

  const startResize = (e) => {
    e.preventDefault();
    setOverlay(prev => ({ ...prev, resizing: true, offsetX: e.clientX, offsetY: e.clientY }));
    window.addEventListener('mousemove', resizeMove);
    window.addEventListener('mouseup', endResize);
  };
  const resizeMove = (e) => {
    setOverlay(prev => {
      if (!prev.resizing) return prev;
      const dx = e.clientX - prev.offsetX;
      const dy = e.clientY - prev.offsetY;
      const newW = Math.max(120, Math.min(prev.w + dx, window.innerWidth / 1.5));
      const newH = Math.max(80, Math.min(prev.h + dy, window.innerHeight / 1.5));
      return { ...prev, w: newW, h: newH, offsetX: e.clientX, offsetY: e.clientY };
    });
  };
  const endResize = () => {
    setOverlay(prev => ({ ...prev, resizing: false }));
    window.removeEventListener('mousemove', resizeMove);
    window.removeEventListener('mouseup', endResize);
  };

  // Build participants array: local first, then remotes
  const participants = [{ id: 'local', stream: localStreamRef.current, name: name }].concat(
    Object.entries(remoteStreams).map(([id, stream]) => ({ id, stream, name: id }))
  );

  // helpers to change expanded scale
  const increaseScale = () => setExpandedScale(s => Math.min(2.0, +(s + 0.1).toFixed(2)));
  const decreaseScale = () => setExpandedScale(s => Math.max(0.6, +(s - 0.1).toFixed(2)));

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-900 text-white">
      <header className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="font-semibold">CamMeet</div>
          <div className="text-sm text-gray-300">Room: <span className="font-mono text-xs ml-1">{roomId}</span></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-300">You: {name}</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className={`flex-1 transition-all duration-200 ${showChat ? 'w-3/4' : 'w-full'} p-3`}>
          <div className="w-full h-full bg-black/60 rounded-lg p-2 flex items-stretch">
            {selectedTile ? (
              <div className="relative w-full h-full rounded overflow-hidden">
                <div className="w-full h-full relative overflow-hidden" style={{ transform: `scale(${expandedScale})`, transformOrigin: 'center center' }}>
                  <ExpandedTile selectedId={selectedTile} participants={participants} localVideoRef={localVideoRef} localStreamRef={localStreamRef} isScreenSharing={isScreenSharing} />
                </div>

                {/* scale controls (expand / shrink) shown on expanded view */}
                <div className="absolute top-3 right-3 flex gap-2 z-40">
                  <button onClick={decreaseScale} className="bg-white/10 p-2 rounded hover:bg-white/20">−</button>
                  <button onClick={() => setExpandedScale(1)} className="bg-white/10 p-2 rounded hover:bg-white/20">Reset</button>
                  <button onClick={increaseScale} className="bg-white/10 p-2 rounded hover:bg-white/20">+</button>
                </div>

                {/* Render the draggable/resizable overlay only when screen-sharing and local is selected */}
                {isScreenSharing && selectedTile === 'local' && localStreamRef.current && (
                  <div className="fixed z-30" style={{ left: overlay.x, top: overlay.y, width: overlay.w, height: overlay.h, cursor: overlay.dragging ? 'grabbing' : 'grab' }}>
                    <div onMouseDown={startDrag} className="w-full h-full bg-black rounded overflow-hidden border border-white/20">
                      <video className="w-full h-full object-cover" autoPlay playsInline muted ref={el => { if (el) el.srcObject = localStreamRef.current; }} />
                      <div onMouseDown={startResize} className="absolute right-1 bottom-1 w-4 h-4 bg-white/30 rounded cursor-nwse-resize" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full h-full">
                {participants.map(p => (
                  <Tile key={p.id} part={p} onClick={() => handleTileClick(p.id)} isLocal={p.id === 'local'} localVideoRef={localVideoRef} />
                ))}
              </div>
            )}
          </div>
        </main>

        {showChat && (
          <aside className="w-1/4 border-l border-white/10 bg-white/5 p-3 overflow-auto">
            <div className="text-sm font-semibold mb-3">Chat</div>
            <div className="flex-1 space-y-2">
              {chat.map((m, i) => (
                <div key={i} className="text-sm">
                  <div className="font-semibold">{m.name} <span className="text-xs text-gray-300 ml-2">{new Date(m.time).toLocaleTimeString()}</span></div>
                  <div className="text-gray-100">{m.message}</div>
                </div>
              ))}
            </div>
            <ChatInput onSend={sendChat} />
          </aside>
        )}
      </div>

      <footer className="p-3 bg-black/70 border-t border-white/10 flex items-center justify-center gap-6">
        <button onClick={toggleMute} className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded hover:bg-white/20">
          {isMuted ? <MicOffIcon /> : <MicOnIcon />} <span className="hidden sm:inline text-sm">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button onClick={toggleCam} className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded hover:bg-white/20">
          {camOn ? <CamOnIcon /> : <CamOffIcon />} <span className="hidden sm:inline text-sm">{camOn ? 'Camera' : 'Camera Off'}</span>
        </button>

        <button onClick={shareScreen} className={`flex items-center gap-2 px-4 py-2 rounded ${isScreenSharing ? 'bg-green-600' : 'bg-white/10'} hover:opacity-90`}>
          <ScreenIcon /> <span className="hidden sm:inline text-sm">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>

        <button onClick={() => setShowChat(prev => !prev)} className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded hover:bg-white/20">
          <ChatIcon /> <span className="hidden sm:inline text-sm">Chat</span>
        </button>

        <button onClick={endMeeting} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          End Meeting
        </button>

      </footer>
    </div>
  );
}

/* Tile component */
function Tile({ part, onClick, isLocal, localVideoRef }) {
  if (isLocal) return (
    <div onClick={onClick} className="relative bg-black rounded overflow-hidden aspect-square cursor-pointer">
      <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      <div className="absolute left-2 top-2 bg-black/50 text-xs px-2 py-1 rounded">{part.name}</div>
    </div>
  );
  return (
    <div onClick={onClick} className="relative bg-black rounded overflow-hidden aspect-square cursor-pointer">
      <RemoteVideo stream={part.stream} />
      <div className="absolute left-2 top-2 bg-black/50 text-xs px-2 py-1 rounded">{part.name}</div>
    </div>
  );
}

/* ExpandedTile - large tile view */
function ExpandedTile({ selectedId, participants, localVideoRef, localStreamRef, isScreenSharing }) { 
  const selected = participants.find(p => p.id === selectedId);
  if (!selected)
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300">
        Participant not found
      </div>
    );

  if (selected.id === 'local') 
    return (
      <div className="w-full h-full relative rounded overflow-hidden">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute left-3 top-3 bg-black/50 px-3 py-1 rounded text-sm">
          {selected.name} (You)
        </div>
        {isScreenSharing && localStreamRef.current && (
          <div className="absolute right-4 bottom-4 w-40 h-28 bg-black border border-white/20 rounded overflow-hidden">
            <video
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
              ref={el => { if (el) el.srcObject = localStreamRef.current; }}
            />
          </div>
        )}
      </div>
    );

  // For remote participants
  return (
    <div className="w-full h-full relative rounded overflow-hidden">
      <RemoteVideo stream={selected.stream} large />
      <div className="absolute left-3 top-3 bg-black/50 px-3 py-1 rounded text-sm">{selected.name}</div>
    </div>
  );
}


/* RemoteVideo helper */
function RemoteVideo({ stream }) {
  const ref = useRef();
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline className="w-full h-full object-cover bg-black" />;
}

/* Chat input */
function ChatInput({ onSend }) {
  const [val, setVal] = useState('');
  const submit = (e) => {
    e?.preventDefault();
    const v = val.trim();
    if (!v) return;
    onSend(v);
    setVal('');
  };
  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex gap-2">
        <input value={val} onChange={e => setVal(e.target.value)} placeholder="Write a message..." className="flex-1 p-2 bg-white/5 rounded border border-white/10" />
        <button type="submit" className="px-3 py-2 bg-green-600 rounded">Send</button>
      </div>
    </form>
  );
}

/* Simple icons */
function MicOnIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 11v1a7 7 0 0 1-14 0v-1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 19v3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function MicOffIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 9v3a3 3 0 0 0 5.12 2.39" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 8.71V5a3 3 0 0 0-6 0v3.71" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 3l18 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function CamOnIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="13" height="12" rx="2" stroke="white" strokeWidth="1.5"/><path d="M16 8l4-2v12l-4-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function CamOffIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="13" height="12" rx="2" stroke="white" strokeWidth="1.5"/><path d="M3 3l18 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function ScreenIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="14" rx="2" stroke="white" strokeWidth="1.5"/><path d="M8 21h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function ChatIcon() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
